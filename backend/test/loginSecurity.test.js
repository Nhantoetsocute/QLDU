const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createVault}=require('../src/security/cryptoVault');
const {createDataFields}=require('../src/security/dataFields');
const {createLoginService,LOCK_STEP_SECONDS}=require('../src/services/loginService');
const {createPasswordChangeService}=require('../src/services/passwordChangeService');
const {createOtpService}=require('../src/services/otpService');
const {assertPasswordAllowed,isCommonPassword}=require('../src/security/passwordPolicy');
const {schemas}=require('../src/security/validation');
const {applyLoginSecurityMigration,COLUMNS}=require('../scripts/migrate-login-security');

const vault=createVault({
    version:1,activeKeyId:'login-security-test',
    encryptionKeys:{'login-security-test':Buffer.alloc(32,21).toString('base64')},
    otpKey:Buffer.alloc(32,22).toString('base64'),indexKey:Buffer.alloc(32,23).toString('base64'),
});
const fields=createDataFields(vault);
function userFixture(patch={}) {
    const clear={UserId:7,UserCode:'USR00000007',UserName:'Test User',Email:'login@example.invalid',PasswordHash:'correct',Phone:null,AvatarUrl:null,IsActive:1};
    const protectedUser=fields.protectRow('Users',clear,{allowPlaintext:true});
    return {
        ...protectedUser,EmailLookup:fields.userLookups(clear).EmailLookup,IsActive:1,
        FailedLoginAttempts:0,FirstFailedLoginAt:null,LastFailedLoginAt:null,LockedUntil:null,
        LoginLockDurationSeconds:0,...patch,
    };
}
function loginFixture(patch={}) {
    let time=Date.UTC(2026,10,8,0,0,0);
    const user=userFixture(patch);
    let queue=Promise.resolve();
    const calls=[];
    const pool={getConnection:async()=>{
        let unlock;
        return {
            beginTransaction:async()=>{const previous=queue;queue=new Promise(resolve=>unlock=resolve);await previous;},
            commit:async()=>{},rollback:async()=>{},release:()=>unlock(),
            execute:async(sql,args)=>{
                calls.push({sql,args});
                if(sql.startsWith('SELECT UserId')) {
                    if(patch.missing) return [[],[]];
                    return [[{...user}],[]];
                }
                if(sql.startsWith('SELECT NOW(3)')) {
                    return [[{LoginNow:new Date(time)}],[]];
                }
                if(sql.startsWith('UPDATE Users SET FailedLoginAttempts')) {
                    user.FailedLoginAttempts=args[0];
                    if(args[1]) user.FirstFailedLoginAt=new Date(time);
                    user.LastFailedLoginAt=new Date(time);
                    user.LockedUntil=args[2]?new Date(time+args[3]*1000):null;
                    user.LoginLockDurationSeconds=args[4];
                    return [{affectedRows:1},[]];
                }
                if(sql.startsWith('UPDATE Users SET PasswordHash')) {
                    user.PasswordHash=args[0];
                    user.FailedLoginAttempts=0;user.FirstFailedLoginAt=null;user.LastFailedLoginAt=null;
                    user.LockedUntil=null;user.LoginLockDurationSeconds=0;
                    return [{affectedRows:1},[]];
                }
                throw new Error(`Unexpected SQL: ${sql}`);
            },
        };
    }};
    const service=createLoginService({
        pool,vault,dummyHash:'dummy',comparePassword:async(candidate,hash)=>candidate===hash,
        hashPassword:async()=> 'upgraded',needsRehash:()=>false,now:()=>time,
    });
    return {user,calls,service,advance:ms=>{time+=ms;},time:()=>time};
}

test('one and three consecutive failures are recorded without locking; third is a warning threshold',async()=>{
    const f=loginFixture();
    let result=await f.service.authenticate('login@example.invalid','wrong');
    assert.equal(result.ok,false);assert.equal(f.user.FailedLoginAttempts,1);assert.equal(result.locked,false);
    for(let i=1;i<3;i++) result=await f.service.authenticate('login@example.invalid','wrong');
    assert.equal(f.user.FailedLoginAttempts,3);
    assert.equal(f.user.LockedUntil,null);
    assert.equal(result.warningLevel,3);
});

test('fourth consecutive failure locks for 30 seconds; even the correct password is refused until expiry',async()=>{
    const f=loginFixture();
    for(let i=0;i<4;i++) await f.service.authenticate('login@example.invalid','wrong');
    assert.equal(f.user.FailedLoginAttempts,4);
    assert.equal(f.user.LockedUntil.getTime(),f.time()+LOCK_STEP_SECONDS*1000);
    assert.equal((await f.service.authenticate('login@example.invalid','correct')).ok,false);
    assert.equal(f.user.FailedLoginAttempts,4);
    f.advance(LOCK_STEP_SECONDS*1000+1);
    assert.equal((await f.service.authenticate('login@example.invalid','correct')).ok,true);
    assert.equal(f.user.FailedLoginAttempts,0);
    assert.equal(f.user.LockedUntil,null);
    assert.equal(f.user.LoginLockDurationSeconds,0);
});

test('each wrong retry after an expired lock increases the duration by 30 seconds',async()=>{
    const f=loginFixture();
    for(let i=0;i<4;i++) await f.service.authenticate('login@example.invalid','wrong');
    f.advance(LOCK_STEP_SECONDS*1000+1);
    await f.service.authenticate('login@example.invalid','wrong');
    assert.equal(f.user.LoginLockDurationSeconds,60);
    assert.equal(f.user.LockedUntil.getTime(),f.time()+60_000);
    f.advance(60_001);
    await f.service.authenticate('login@example.invalid','wrong');
    assert.equal(f.user.LoginLockDurationSeconds,90);
});

test('failure counter resets after 30 seconds without a new failure',async()=>{
    const f=loginFixture();
    await f.service.authenticate('login@example.invalid','wrong');
    await f.service.authenticate('login@example.invalid','wrong');
    f.advance(30_001);
    await f.service.authenticate('login@example.invalid','wrong');
    assert.equal(f.user.FailedLoginAttempts,1);
});

test('concurrent failed requests serialize on the account row and do not lose increments',async()=>{
    const f=loginFixture();
    await Promise.all([
        f.service.authenticate('login@example.invalid','wrong'),
        f.service.authenticate('login@example.invalid','wrong'),
    ]);
    assert.equal(f.user.FailedLoginAttempts,2);
    assert.ok(f.calls.filter(call=>call.sql.startsWith('SELECT UserId')).every(call=>call.sql.endsWith('FOR UPDATE')));
});

test('inactive admin-disabled accounts remain unavailable after any temporary-lock interval',async()=>{
    const f=loginFixture({IsActive:0});
    for(let i=0;i<5;i++) await f.service.authenticate('login@example.invalid','correct');
    f.advance(24*60*60*1000);
    assert.equal((await f.service.authenticate('login@example.invalid','correct')).ok,false);
    assert.equal(f.user.IsActive,0);
});

test('unknown and invalid credentials return the same generic service outcome',async()=>{
    const missing=loginFixture({missing:true});
    const absent=await missing.service.authenticate('unknown@example.invalid','wrong');
    const existing=loginFixture();
    const invalid=await existing.service.authenticate('login@example.invalid','wrong');
    assert.equal(absent.ok,false);
    assert.equal(invalid.ok,false);
});

test('registration and reset validation reject common full-password matches',()=>{
    for(const password of ['12345678','Password1!']) {
        assert.equal(isCommonPassword(password),true);
        assert.throws(()=>schemas.register({userName:'Name',email:'a@example.invalid',password}),{code:'WEAK_PASSWORD'});
        assert.throws(()=>schemas.reset({email:'a@example.invalid',otp:'123456',newPassword:password}),{code:'WEAK_PASSWORD'});
    }
    assert.equal(schemas.register({userName:'Name',email:'a@example.invalid',password:'unique long phrase 2026'}).password,'unique long phrase 2026');
});

test('HIBP range lookup sends only the SHA-1 prefix and rejects an exact leaked-password match',async()=>{
    const password='unique-leaked-password-7f6a';
    const digest=createHash('sha1').update(password).digest('hex').toUpperCase();
    let requested;
    await assert.rejects(assertPasswordAllowed(password,{
        fetchImpl:async(url,options)=>{
            requested={url,options};
            return {ok:true,text:async()=>`${digest.slice(5)}:12\n${'A'.repeat(35)}:1\n`};
        },
        now:()=>0,
    }),{code:'WEAK_PASSWORD'});
    assert.equal(requested.url,`https://api.pwnedpasswords.com/range/${digest.slice(0,5)}`);
    assert.equal(requested.url.includes(password),false);
    assert.equal(requested.options.headers['Add-Padding'],'true');
});

test('available password check accepts a long password absent from local and breached lists',async()=>{
    let called=0;
    await assertPasswordAllowed('unlisted private passphrase 2026',{
        fetchImpl:async()=>{called++;return {ok:true,text:async()=>`${'F'.repeat(35)}:3\n`};},
        now:()=>0,
    });
    assert.equal(called,1);
});

test('password verification is fail-closed when the breached-password source is unavailable',async()=>{
    await assert.rejects(assertPasswordAllowed('network unavailable unique passphrase',{
        fetchImpl:async()=>{throw new Error('offline');},now:()=>0,
    }),{code:'PASSWORD_CHECK_UNAVAILABLE',status:503});
    await assert.rejects(assertPasswordAllowed('malformed response unique passphrase',{
        fetchImpl:async()=>({ok:true,text:async()=>''}),now:()=>0,
    }),{code:'PASSWORD_CHECK_UNAVAILABLE',status:503});
});

test('OTP reset cannot update a password when the breached-password check rejects it',async()=>{
    let updated=false;
    const pool={getConnection:async()=>({
        beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},
        execute:async(sql)=>{if(sql.startsWith('UPDATE Users SET PasswordHash'))updated=true;return [[],[]];},
    })};
    const service=createOtpService({
        pool,checkPassword:async()=>{const error=new Error('compromised');error.code='WEAK_PASSWORD';throw error;},
    });
    await assert.rejects(service.reset('user@example.invalid','123456','a unique passphrase 2026'),{code:'WEAK_PASSWORD'});
    assert.equal(updated,false);
});

test('password change rejects common passwords before hashing and invalidates login counters on success',async()=>{
    let hashed=0;
    const pool={
        getConnection:async()=>({
            beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},
            execute:async(sql,args)=>{
                if(sql.startsWith('SELECT UserId')) return [[{UserId:7,IsActive:1,PasswordHash:'current'}]];
                if(sql.startsWith('UPDATE Users SET PasswordHash')) {hashed++;assert.equal(args[0],'new-hash');return [{affectedRows:1}];}
                throw new Error('Unexpected SQL');
            },
        }),
    };
    const service=createPasswordChangeService({pool,comparePassword:async(password,hash)=>password===hash,hashPassword:async()=> 'new-hash',checkPassword:async()=>{}});
    await assert.rejects(service.change(7,'current','Password1!'),{code:'WEAK_PASSWORD'});
    assert.equal(hashed,0);
    assert.equal(await service.change(7,'current','a unique new passphrase'),true);
    assert.equal(hashed,1);
});

test('login migration is idempotent and adds all persistent lockout fields',async()=>{
    const present=new Set();
    const connection={
        execute:async(_sql,args)=>[[{n:present.has(args[1])?1:0}]],
        query:async(sql)=>{const column=/ADD COLUMN `([^`]+)`/.exec(sql)?.[1];assert.ok(column);present.add(column);},
    };
    await applyLoginSecurityMigration(connection);
    await applyLoginSecurityMigration(connection);
    assert.equal(present.size,COLUMNS.length);
});
