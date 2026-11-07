const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {createVault}=require('../src/security/cryptoVault');
const {writeEncryptedAvatar,readStoredAvatar,avatarContext}=require('../src/security/avatarStorage');
const {createAvatarController}=require('../src/controllers/avatarController');
const {migrateAvatars}=require('../scripts/migrate-avatars');
const vault=createVault({version:1,activeKeyId:'avatar-tests',encryptionKeys:{'avatar-tests':Buffer.alloc(32,11).toString('base64')},otpKey:Buffer.alloc(32,12).toString('base64'),indexKey:Buffer.alloc(32,13).toString('base64')});
async function directory(t) {
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),'qldu-avatar-at-rest-'));
    t.after(()=>fs.rm(directory,{recursive:true,force:true}));
    return directory;
}
async function png() {return sharp({create:{width:4,height:4,channels:3,background:'red'}}).png().toBuffer();}
function response(){return {code:200,headers:{},set(values){Object.assign(this.headers,values);return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},send(body){this.body=body;return this;}};}

test('avatar writes persist authenticated ciphertext with owner-only directory/file permissions',async t=>{
    const dir=path.join(await directory(t),'avatars');
    const name='avatar_7_random.webp',plain=Buffer.from('private image bytes');
    await writeEncryptedAvatar(dir,name,plain,{sealBytes:vault.sealBytes});
    const stored=await readStoredAvatar(dir,name);
    assert.ok(vault.isEncrypted(stored));assert.ok(!stored.includes(plain));
    assert.deepEqual(vault.openBytes(stored,avatarContext(name)),plain);
    assert.equal((await fs.stat(dir)).mode&0o777,0o700);
    assert.equal((await fs.stat(path.join(dir,name))).mode&0o777,0o600);
    await assert.rejects(writeEncryptedAvatar(dir,name,plain,{sealBytes:vault.sealBytes}),{code:'EEXIST'});
});

test('stored avatar copied to another filename cannot be decrypted for a different owner',async t=>{
    const dir=await directory(t),name='avatar_7_one.webp';
    const stored=vault.sealBytes(Buffer.from('private'),'avatar:'+name);
    await fs.writeFile(path.join(dir,'avatar_8_copy.webp'),stored);
    const controller=createAvatarController({avatarDirectory:dir,readAvatar:async()=>'/avatars/avatar_8_copy.webp',decrypt:vault.openBytes});
    const res=response();await controller({user:{userId:8}},res,()=>{throw new Error('Unexpected forwarding');});
    assert.equal(res.code,503);assert.ok(!JSON.stringify(res.body).includes('private'));
});

for(const [name,value] of [['cleartext',Buffer.from('plain private image')],['tampered',null]])test(`avatar API fails closed for ${name} disk content`,async t=>{
    const dir=await directory(t),filename='avatar_7_test.webp';
    let stored=value || vault.sealBytes(Buffer.from('private'),'avatar:'+filename);
    if(!value){stored=Buffer.from(stored);stored[stored.length-1]=stored[stored.length-1]===65?66:65;}
    await fs.writeFile(path.join(dir,filename),stored);
    const controller=createAvatarController({avatarDirectory:dir,readAvatar:async()=>'/avatars/'+filename,decrypt:vault.openBytes});
    const res=response();await controller({user:{userId:7}},res,()=>{throw new Error('Unexpected forwarding');});
    assert.equal(res.code,503);assert.ok(!JSON.stringify(res.body).includes('private'));assert.ok(!JSON.stringify(res.body).includes('qldu:'));
});

test('avatar migration dry-run is non-mutating; apply creates only encrypted backup, preserves bytes and reruns safely',async t=>{
    const root=await directory(t),dir=path.join(root,'avatars'),backups=path.join(root,'private','backups');
    await fs.mkdir(dir);const original=await png(),filename='avatar_7_legacy.png';
    await fs.writeFile(path.join(dir,filename),original,{mode:0o644});
    const dry=await migrateAvatars({directory:dir,backupRoot:backups,vault});assert.equal(dry.legacy,1);assert.equal(dry.converted,0);
    assert.deepEqual(await fs.readFile(path.join(dir,filename)),original);
    await assert.rejects(fs.stat(backups),{code:'ENOENT'});
    const result=await migrateAvatars({directory:dir,backupRoot:backups,apply:true,vault});assert.equal(result.converted,1);
    const stored=await fs.readFile(path.join(dir,filename));assert.ok(vault.isEncrypted(stored));assert.deepEqual(vault.openBytes(stored,'avatar:'+filename),original);
    const [batch]=await fs.readdir(backups);const backup=await fs.readFile(path.join(backups,batch,filename+'.enc'));
    assert.ok(vault.isEncrypted(backup));assert.deepEqual(vault.openBytes(backup,'avatar-backup:'+filename),original);
    assert.equal((await fs.stat(path.join(backups,batch,filename+'.enc'))).mode&0o777,0o600);
    const second=await migrateAvatars({directory:dir,backupRoot:backups,apply:true,vault});assert.equal(second.encrypted,1);assert.equal(second.converted,0);
});

test('avatar migration rejects matching symlinks before converting any legacy file',async t=>{
    const root=await directory(t),dir=path.join(root,'avatars'),target=path.join(root,'outside.png');
    await fs.mkdir(dir);const original=await png();await fs.writeFile(target,original);
    await fs.writeFile(path.join(dir,'avatar_7_a.png'),original);
    await fs.symlink(target,path.join(dir,'avatar_7_z.png'));
    await assert.rejects(migrateAvatars({directory:dir,backupRoot:path.join(root,'private','backups'),apply:true,vault}));
    assert.deepEqual(await fs.readFile(path.join(dir,'avatar_7_a.png')),original);assert.deepEqual(await fs.readFile(target),original);
});

test('avatar migration refuses malformed image bytes instead of wrapping arbitrary data',async t=>{
    const dir=await directory(t);await fs.writeFile(path.join(dir,'avatar_7_bad.png'),'<script>private</script>');
    await assert.rejects(migrateAvatars({directory:dir,vault}));
});
