require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const checksum=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
const { NAME,MAX_STORED_BYTES,avatarContext,secureDirectory,readStoredAvatar,replaceEncryptedAvatar }=require('../src/security/avatarStorage');

async function migrateAvatars({ directory=path.join(__dirname,'../public/avatars'), backupRoot=path.join(__dirname,'../.private/backups'), apply=false,
    vault=require('../src/security/cryptoVault'), now=()=>new Date() }={}) {
    vault.validateKeys();
    const before=await fs.lstat(directory).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if (!before) return {converted:0,encrypted:0,legacy:0,skipped:0,apply};
    if (!before.isDirectory() || before.isSymbolicLink()) throw new Error('Unsafe avatar directory');
    const entries=await fs.readdir(directory,{withFileTypes:true});
    if (entries.length>10000) throw new Error('Too many avatar entries');
    const summary={converted:0,encrypted:0,legacy:0,skipped:0,apply};
    const plans=[];
    // Complete validation precedes any conversion; never accept a matching symlink as a legacy image.
    for (const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
        if (!NAME.test(entry.name)) {summary.skipped++;continue;}
        if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Unsafe avatar entry');
        const stored=await readStoredAvatar(directory,entry.name);
        if (vault.isEncrypted(stored)) {
            const plaintext=vault.openBytes(stored,avatarContext(entry.name));
            if(plaintext.length>5*1024*1024)throw new Error('Avatar exceeds limit');
            summary.encrypted++;continue;
        }
        if (stored.length>5*1024*1024) throw new Error('Legacy avatar exceeds limit');
        const image=sharp(stored,{limitInputPixels:16000000,failOn:'warning',animated:false});
        const meta=await image.metadata();
        const extension=path.extname(entry.name).slice(1).toLowerCase();
        const expected=extension==='jpg'?'jpeg':extension;
        if (!['jpeg','png','webp'].includes(meta.format) || meta.format!==expected || (meta.pages||1)!==1) throw new Error('Invalid legacy avatar');
        // stats forces decoding instead of trusting the MIME/header alone. Original bytes are preserved.
        await image.stats();
        const encrypted=vault.sealBytes(stored,avatarContext(entry.name));
        if(encrypted.length>MAX_STORED_BYTES)throw new Error('Encrypted avatar exceeds limit');
        summary.legacy++;plans.push({filename:entry.name,fingerprint:checksum(stored)});
    }
    if (!apply) return summary;
    await secureDirectory(directory);
    if(plans.length) {
        await secureDirectory(path.dirname(backupRoot));
        await secureDirectory(backupRoot);
        const batch=now().toISOString().replace(/[:.]/g,'-')+'-'+require('node:crypto').randomBytes(8).toString('hex');
        const backupDir=path.join(backupRoot,'avatars-'+batch);
        await secureDirectory(backupDir);
        for(const plan of plans) {
            const current=await readStoredAvatar(directory,plan.filename);
            if(checksum(current)!==plan.fingerprint)throw new Error('Avatar changed during migration');
            await fs.writeFile(path.join(backupDir,plan.filename+'.enc'),vault.sealBytes(current,`avatar-backup:${plan.filename}`),{flag:'wx',mode:0o600});
        }
        for(const plan of plans) {
            // Stop if another process wrote the file after preflight. Keep the service stopped during migration.
            const current=await readStoredAvatar(directory,plan.filename);
            if(checksum(current)!==plan.fingerprint)throw new Error('Avatar changed during migration');
            await replaceEncryptedAvatar(directory,plan.filename,vault.sealBytes(current,avatarContext(plan.filename)));
            summary.converted++;
        }
    }
    for(const entry of entries) if(entry.isFile() && NAME.test(entry.name))await fs.chmod(path.join(directory,entry.name),0o600);
    return summary;
}
if(require.main===module) {
    const args=process.argv.slice(2);
    if(args.some(value=>!['--apply','--dry-run'].includes(value)) || (args.includes('--apply') && args.includes('--dry-run'))) {
        console.error('Usage: node scripts/migrate-avatars.js [--dry-run|--apply]');process.exitCode=1;
    } else migrateAvatars({apply:args.includes('--apply')}).then(summary=>console.log(JSON.stringify(summary))).catch(()=>{console.error('Avatar migration failed. No plaintext/key data is printed. Keep the service stopped and resolve the failed preflight or restore the encrypted backup.');process.exitCode=1;});
}
module.exports={migrateAvatars};
