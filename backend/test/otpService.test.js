const test=require('node:test');
const assert=require('node:assert/strict');
const {createOtpService}=require('../src/services/otpService');
const vault=require('../src/security/cryptoVault');
function fixture() {
    const user={UserId:7,IsActive:1,OTPHash:null,OTPExpiry:null,OTPAttempts:0,PasswordHash:'old-hash'};
    const calls=[];
    let queue=Promise.resolve();
    const pool={execute:async(sql,args)=>{
        calls.push({sql,args});
        if(sql.startsWith('UPDATE Users SET OTPHash = NULL') && args[1]===user.OTPHash) {user.OTPHash=null;user.OTPExpiry=null;user.OTPAttempts=0;}
        return [{affectedRows:1}];
    },getConnection:async()=>{
        let unlock;
        return {
            beginTransaction:async()=>{const previous=queue;queue=new Promise(resolve=>unlock=resolve);await previous;calls.push({sql:'BEGIN'});},
            commit:async()=>calls.push({sql:'COMMIT'}),rollback:async()=>calls.push({sql:'ROLLBACK'}),release:()=>unlock(),
            execute:async(sql,args)=>{
                calls.push({sql,args});
                if(sql.startsWith('SELECT UserId')) return [[{...user}]];
                if(sql.startsWith('UPDATE Users SET OTPCode = NULL')) {user.OTPHash=args[0];user.OTPExpiry=args[1];user.OTPAttempts=0;}
                else if(sql.startsWith('UPDATE Users SET OTPAttempts')) {user.OTPAttempts=args[0];if(args[0]>=5){user.OTPHash=null;user.OTPExpiry=null;}}
                else if(sql.startsWith('UPDATE Users SET PasswordHash')) {user.PasswordHash=args[0];user.OTPHash=null;user.OTPExpiry=null;user.OTPAttempts=0;user.FailedLoginAttempts=0;user.LockedUntil=null;}
                return [{affectedRows:1}];
            },
        };
    }};
    const service=()=>createOtpService({pool,randomCode:()=> '654321',hashPassword:async()=> 'new-hash',checkPassword:async()=>{}});
    return {user,calls,pool,service};
}
test('recovery persists a keyed verifier only and binds it to owner and exact second expiry',async()=>{
    const f=fixture(),s=f.service(),challenge=await s.issue(' user@example.invalid ');
    assert.equal(challenge.otpCode,'654321');
    assert.match(f.user.OTPHash,/^[a-f0-9]{64}$/);
    assert.equal(f.user.OTPExpiry.getMilliseconds(),0);
    assert.equal(f.calls.some(c=>JSON.stringify(c.args||[]).includes('654321')),false);
    assert.equal(vault.verifyOtpDigest(8,f.user.OTPExpiry,challenge.otpCode,f.user.OTPHash),false);
    assert.ok(f.calls.filter(c=>c.sql.startsWith('SELECT')).every(c=>c.sql.endsWith('FOR UPDATE')));
    assert.equal(await s.verify('user@example.invalid',challenge.otpCode),true);
});
test('database attempts survive service recreation and lock the challenge after five failures',async()=>{
    const f=fixture();await f.service().issue('user@example.invalid');
    for(let i=0;i<5;i++)assert.equal(await f.service().verify('user@example.invalid','111111'),false);
    assert.equal(f.user.OTPAttempts,5);assert.equal(f.user.OTPHash,null);
    assert.equal(await f.service().reset('user@example.invalid','654321','a long password'),false);
    assert.equal(f.user.PasswordHash,'old-hash');
    assert.equal(f.calls.filter(c=>c.sql==='ROLLBACK').length,0);
});
test('expired, inactive and legacy-plaintext challenges cannot reset a password',async()=>{
    for(const patch of [{OTPExpiry:new Date(Date.now()-1000)},{IsActive:0},{OTPCode:'654321',OTPHash:null}]) {
        const f=fixture();await f.service().issue('user@example.invalid');Object.assign(f.user,patch);
        assert.equal(await f.service().reset('user@example.invalid','654321','a long password'),false);
        assert.equal(f.user.PasswordHash,'old-hash');
    }
});
test('two concurrent reset requests consume the same challenge once',async()=>{
    const f=fixture(),s=f.service();await s.issue('user@example.invalid');
    const results=await Promise.all([s.reset('user@example.invalid','654321','a long password'),s.reset('user@example.invalid','654321','a long password')]);
    assert.deepEqual(results.sort(),[false,true]);assert.equal(f.user.OTPHash,null);assert.equal(f.user.PasswordHash,'new-hash');
});
test('email-send failure invalidates only the challenge it issued, not a newer one',async()=>{
    const f=fixture(),s=f.service(),old=await s.issue('user@example.invalid');
    f.user.OTPHash='a'.repeat(64);
    await s.revokeIssued(old);assert.equal(f.user.OTPHash,'a'.repeat(64));
    const query=f.calls.at(-1);assert.match(query.sql,/WHERE UserId = \? AND OTPHash = \?/);
});
