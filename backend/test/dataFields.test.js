const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createVault}=require('../src/security/cryptoVault');
const {createDataFields,definitions}=require('../src/security/dataFields');
const {planMigration,writeBackup}=require('../scripts/migrate-storage');
const {readBackup}=require('../scripts/check-storage-backup');
const vault=createVault({version:1,activeKeyId:'tests',encryptionKeys:{tests:Buffer.alloc(32,1).toString('base64')},otpKey:Buffer.alloc(32,2).toString('base64'),indexKey:Buffer.alloc(32,3).toString('base64')});
const fields=createDataFields(vault);
const users=[{UserId:7,UserName:'Private test name',Email:'USER@example.invalid',Phone:'0901234567',Address:'Private test address'}];
function fakeDatabase(rowsByTable={Users:users}) {
    return {
        execute:async(sql,args)=>{
            const table=/FROM `([^`]+)`/.exec(sql)?.[1];
            if(!table) throw new Error('Unexpected migration query');
            return [(rowsByTable[table] || []).filter(row=>BigInt(row[definitions[table].id])>BigInt(args[0])).slice(0,100)];
        },
        query:async(sql)=>{
            const table=/SHOW CREATE TABLE `([^`]+)`/.exec(sql)?.[1];
            if(!table) throw new Error('Unexpected schema query');
            return [[{'Create Table':`CREATE TABLE ${table} (id BIGINT)`}]];
        },
    };
}
test('all contact fields round-trip with Unicode while ids and accounting fields remain unchanged',()=>{
    for(const [table,spec] of Object.entries(definitions)) {
        const clear={[spec.id]:7,TotalAmount:'25000.00',StatusId:3};
        for(const column of spec.fields)clear[column]='Dữ liệu cá nhân: '+column;
        const encrypted=fields.protectRow(table,clear,{allowPlaintext:true});
        for(const column of spec.fields){assert.equal(vault.isEncrypted(encrypted[column]),true);assert.ok(!encrypted[column].includes(clear[column]));}
        assert.deepEqual(fields.revealRow(table,encrypted),clear);
    }
});
test('ciphertext cannot be moved to another row, table or column',()=>{
    const ciphertext=fields.sealField('Users',7,'Phone','0901234567');
    for(const args of [['Users',8,'Phone'],['Users',7,'Address'],['DeliveryAddresses',7,'Phone']]) assert.throws(()=>fields.openField(...args,ciphertext));
});
test('production reads reject plaintext, including empty strings; migration permission is explicit',()=>{
    for(const value of ['plain contact','']) {
        assert.throws(()=>fields.openField('Users',7,'Phone',value),{code:'STORAGE_PLAINTEXT'});
        assert.equal(fields.openField('Users',7,'Phone',value,{allowPlaintext:true}),value);
    }
    assert.equal(fields.openField('Users',7,'Phone',null),null);
});
test('rerunnable migration validates already-encrypted fields and never double encrypts',()=>{
    const encrypted=fields.protectRow('Users',users[0],{allowPlaintext:true});
    assert.deepEqual(fields.protectRow('Users',encrypted,{allowPlaintext:true}),encrypted);
    assert.throws(()=>fields.protectRow('Users',{...encrypted,UserId:8},{allowPlaintext:true}));
    assert.throws(()=>fields.openField('Users',7,'Phone','qldu:broken',{allowPlaintext:true}));
});
test('email and phone blind indexes are normalized and isolated by purpose',()=>{
    assert.equal(fields.userLookups({Email:' USER@example.invalid '}).EmailLookup,fields.userLookups({Email:'user@example.invalid'}).EmailLookup);
    assert.equal(fields.userLookups({Phone:null}).PhoneLookup,null);
    assert.equal(fields.userLookups({Phone:''}).PhoneLookup,null);
    assert.deepEqual(fields.userLookups({}),{});
    assert.notEqual(vault.blindIndex('same','Users.Email'),vault.blindIndex('same','Users.Phone'));
});
test('dry-run migration counts legacy fields without mutating storage and rejects duplicate normalized contacts',async()=>{
    const plan=await planMigration(fakeDatabase(),vault);
    assert.equal(plan.counts.Users,1);assert.equal(plan.pendingFields,4);
    await assert.rejects(planMigration(fakeDatabase({Users:[...users,{...users[0],UserId:8,Email:'user@example.invalid'}]}),vault),{code:'STORAGE_DUPLICATE_CONTACT_LOOKUP'});
});
test('before-image backup is private, authenticated and recoverable without plaintext disk output',async t=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'qldu-storage-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
    const backup=await writeBackup(fakeDatabase(),vault,path.join(root,'backups'));
    assert.equal((await fs.stat(backup)).mode & 0o777,0o600);
    const raw=await fs.readFile(backup);assert.equal(raw.includes(Buffer.from('Private test name')),false);assert.equal(raw.includes(Buffer.from('USER@example.invalid')),false);
    let recovered;
    const summary=await readBackup(backup,{vault,onRecord(record){if(record.table==='Users' && record.rows)recovered=record.rows;}});
    assert.equal(summary.status,'verified');assert.deepEqual(recovered,users);
    const modified=Buffer.from(raw);modified[modified.length-10]^=1;const corrupted=path.join(root,'corrupt.enc');await fs.writeFile(corrupted,modified,{mode:0o600});
    await assert.rejects(readBackup(corrupted,{vault}));
    const truncated=path.join(root,'truncated.enc');await fs.writeFile(truncated,raw.subarray(0,raw.length-50),{mode:0o600});
    await assert.rejects(readBackup(truncated,{vault}));
});
