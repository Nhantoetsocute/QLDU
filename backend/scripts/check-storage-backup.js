// Authenticate and inspect an encrypted before-image without printing contact data.
// The exported reader supports an operator-controlled recovery tool; this CLI does
// not write decrypted files or automatically restore/change a database.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {BACKUP_MAGIC}=require('./migrate-storage');
const invalid=()=>{const error=new Error('Invalid storage backup.');error.code='STORAGE_BACKUP_INVALID';return error;};
async function readBackup(filename,{vault,onRecord=()=>{}}={}) {
    if(!vault) vault=require('../src/security/cryptoVault');
    const handle=await fs.open(filename,'r');
    const chain=crypto.createHash('sha256');
    const counts={};let frames=0,manifest=null;
    async function readExactly(length,{optional=false}={}) {
        if(length>24*1024*1024) throw invalid();
        const buffer=Buffer.alloc(length);let offset=0;
        while(offset<length){const result=await handle.read(buffer,offset,length-offset,null);if(!result.bytesRead){if(optional && !offset) return null;throw invalid();}offset+=result.bytesRead;}
        return buffer;
    }
    try {
        if(!(await readExactly(BACKUP_MAGIC.length)).equals(BACKUP_MAGIC)) throw invalid();
        for(;;) {
            const size=await readExactly(4,{optional:true});if(!size)break;
            if(manifest)throw invalid();
            const cipher=await readExactly(size.readUInt32BE());
            let record;
            try {record=JSON.parse(vault.openBytes(cipher,'backup:storage-v1').toString('utf8'));}catch{throw invalid();}
            if(!record || typeof record!=='object' || Array.isArray(record))throw invalid();
            if(record.manifest===true){manifest=record;continue;}
            chain.update(size);chain.update(cipher);frames++;
            if(record.table && Array.isArray(record.rows)) counts[record.table]=(counts[record.table] || 0)+record.rows.length;
            if(record.table && record.schema && !Object.hasOwn(counts,record.table))counts[record.table]=0;
            // Callers receive validated frames, but must not apply a recovery until
            // the final manifest has been validated by this function's completion.
            await onRecord(record);
        }
        if(!manifest || manifest.frames!==frames || manifest.digest!==chain.digest('hex') || JSON.stringify(manifest.counts)!==JSON.stringify(counts)) throw invalid();
        return {status:'verified',counts,frames};
    } finally {await handle.close();}
}
async function main(){
    require('dotenv').config({path:path.join(__dirname,'../.env')});
    if(process.argv.length!==3)throw invalid();
    const result=await readBackup(path.resolve(process.argv[2]));console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(error=>{console.error('Storage backup check failed:',/^[A-Z_0-9]+$/.test(error.code||'')?error.code:'STORAGE_BACKUP_INVALID');process.exitCode=1;});
module.exports={readBackup};
