// Offline, rerunnable migration. Defaults to a read-only plan; --apply also requires
// --confirm-app-stopped because MySQL ALTER TABLE commits outside transactions.
const path = require('node:path');
const fs = require('node:fs/promises');
const { definitions, createDataFields } = require('../src/security/dataFields');
const { databaseTlsOptions } = require('../src/security/transport');
const TABLES = Object.keys(definitions);
const MAX_ROWS_PER_TABLE = 100000;
const BACKUP_MAGIC = Buffer.from('QLDU-STORAGE-BACKUP-V1\n');
const codeError = code => { const error = new Error(code); error.code = code; return error; };
const fieldSelect = table => [definitions[table].id, ...definitions[table].fields].map(name => `\`${name}\``).join(', ');
const keyCheck = vault => vault.blindIndex('storage-v1', 'storage.metadata');

async function tableExists(connection, table) {
    const [rows] = await connection.execute('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
    return Number(rows[0].n) === 1;
}
async function metadata(connection, key) {
    if (!await tableExists(connection, 'AppSecurityMetadata')) return null;
    const [rows] = await connection.execute('SELECT MetaValue FROM AppSecurityMetadata WHERE MetaKey = ?', [key]);
    return rows[0]?.MetaValue ?? null;
}
async function setMetadata(connection, key, value) {
    await connection.execute('INSERT INTO AppSecurityMetadata (MetaKey, MetaValue) VALUES (?, ?) ON DUPLICATE KEY UPDATE MetaValue = VALUES(MetaValue)', [key, value]);
}
async function scan(connection, table, visit, { locking = false, batchSize = 100 } = {}) {
    const primary = definitions[table].id;
    let last = '0', count = 0;
    for (;;) {
        const [rows] = await connection.execute(`SELECT ${fieldSelect(table)} FROM \`${table}\` WHERE \`${primary}\` > ? ORDER BY \`${primary}\` LIMIT ${batchSize}${locking ? ' FOR UPDATE' : ''}`, [last]);
        if (!rows.length) break;
        count += rows.length;
        if (count > MAX_ROWS_PER_TABLE) throw codeError('STORAGE_MIGRATION_REQUIRES_OPERATOR_BATCHING');
        await visit(rows);
        last = String(rows[rows.length - 1][primary]);
    }
    return count;
}
async function planMigration(connection, vault) {
    const fields = createDataFields(vault);
    const counts = {}, plaintext = {};
    const emailIndexes = new Set(), phoneIndexes = new Set();
    for (const table of TABLES) {
        plaintext[table] = 0;
        counts[table] = await scan(connection, table, async rows => {
            for (const row of rows) {
                const clear = fields.revealRow(table, row, { allowPlaintext: true });
                for (const name of definitions[table].fields) if (row[name] != null && !vault.isEncrypted(row[name])) plaintext[table]++;
                if (table === 'Users') {
                    const lookups = fields.userLookups(clear);
                    for (const [value, seen] of [[lookups.EmailLookup, emailIndexes], [lookups.PhoneLookup, phoneIndexes]]) {
                        if (value === null) continue;
                        if (seen.has(value)) throw codeError('STORAGE_DUPLICATE_CONTACT_LOOKUP');
                        seen.add(value);
                    }
                }
            }
        });
    }
    return { counts, plaintext, pendingFields: Object.values(plaintext).reduce((sum,n)=>sum+n,0) };
}
async function ensurePrivateDirectory(directory) {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await fs.lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw codeError('STORAGE_UNSAFE_BACKUP_DIRECTORY');
    await fs.chmod(directory, 0o700);
}
async function writeBackup(connection, vault, directory) {
    await ensurePrivateDirectory(path.dirname(directory));
    await ensurePrivateDirectory(directory);
    const filename = path.join(directory, `storage-${Date.now()}-${require('node:crypto').randomBytes(6).toString('hex')}.enc`);
    const handle = await fs.open(filename, 'wx', 0o600);
    let bytes = BACKUP_MAGIC.length;
    const chain=require('node:crypto').createHash('sha256');
    const counts={};
    let frames=0;
    try {
        await handle.writeFile(BACKUP_MAGIC);
        async function frame(record,manifest=false) {
            const encrypted = vault.sealBytes(Buffer.from(JSON.stringify(record), 'utf8'), 'backup:storage-v1');
            const buffer = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted, 'utf8');
            bytes += buffer.length + 4;
            if (bytes > 256 * 1024 * 1024) throw codeError('STORAGE_BACKUP_TOO_LARGE');
            const size = Buffer.alloc(4); size.writeUInt32BE(buffer.length);
            await handle.writeFile(size); await handle.writeFile(buffer);
            if(!manifest){chain.update(size);chain.update(buffer);frames++;}
        }
        await frame({ format: 'qldu-storage-v1', at: new Date().toISOString(), tables: TABLES });
        for (const table of TABLES) {
            const [[schema]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
            await frame({ table, schema: schema['Create Table'] });
            counts[table]=await scan(connection,table,async rows=>{for(const row of rows) await frame({table,rows:[row]});});
        }
        await frame({manifest:true,counts,frames,digest:chain.digest('hex')},true);
        await handle.sync();
        await handle.close();
        return filename;
    } catch (error) {
        await handle.close().catch(()=>{});
        await fs.unlink(filename).catch(()=>{});
        throw error;
    }
}
async function columnExists(connection,table,column) {
    const [rows]=await connection.execute('SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table,column]);
    return Number(rows[0].n)===1;
}
async function addColumn(connection,table,column,type) {
    if (!await columnExists(connection,table,column)) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`);
}
async function indexes(connection) {
    const [rows]=await connection.query('SHOW INDEX FROM Users');
    const groups=new Map();
    for (const row of rows) {
        if (!groups.has(row.Key_name)) groups.set(row.Key_name,{name:row.Key_name,unique:Number(row.Non_unique)===0,columns:[]});
        groups.get(row.Key_name).columns[Number(row.Seq_in_index)-1]=row.Column_name;
    }
    return [...groups.values()];
}
function quotedIdentifier(value) {
    if (!/^[A-Za-z0-9_]+$/.test(value)) throw codeError('STORAGE_UNSUPPORTED_INDEX_NAME');
    return `\`${value}\``;
}
async function prepareSchema(connection) {
    const oldIndexes=await indexes(connection);
    for (const index of oldIndexes) {
        if (!index.columns.some(name=>['Email','Phone'].includes(name))) continue;
        if(index.columns.length!==1 || index.name==='PRIMARY') throw codeError('STORAGE_UNSUPPORTED_CONTACT_INDEX');
        await connection.query(`ALTER TABLE Users DROP INDEX ${quotedIdentifier(index.name)}`);
    }
    await addColumn(connection,'Users','EmailLookup','CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL');
    await addColumn(connection,'Users','PhoneLookup','CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL');
    await addColumn(connection,'Users','OTPHash','CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL');
    await addColumn(connection,'Users','OTPAttempts','SMALLINT UNSIGNED NOT NULL DEFAULT 0');
    for (const table of TABLES) {
        const nullable = { Users:['Phone','Address'], Orders:['Note'], DeliveryAddresses:[], Notifications:['Body'] }[table];
        const changes=definitions[table].fields.map(column=>`MODIFY COLUMN \`${column}\` ${table==='Notifications' && column==='Body'?'MEDIUMTEXT':'TEXT'} ${nullable.includes(column)?'NULL':'NOT NULL'}`);
        await connection.query(`ALTER TABLE \`${table}\` ${changes.join(', ')}`);
    }
    await connection.query('CREATE TABLE IF NOT EXISTS AppSecurityMetadata (MetaKey VARCHAR(64) NOT NULL PRIMARY KEY, MetaValue VARCHAR(255) NOT NULL, UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB');
}
async function migrateTable(connection, table, vault) {
    const fields=createDataFields(vault), primary=definitions[table].id;
    let last='0', migrated=0;
    for (;;) {
        await connection.beginTransaction();
        try {
            const [rows]=await connection.execute(`SELECT ${fieldSelect(table)} FROM \`${table}\` WHERE \`${primary}\` > ? ORDER BY \`${primary}\` LIMIT 100 FOR UPDATE`,[last]);
            if(!rows.length){await connection.commit();break;}
            for(const row of rows) {
                const protectedRow=fields.protectRow(table,row,{allowPlaintext:true});
                const columns=[...definitions[table].fields];
                if(table==='Users') Object.assign(protectedRow,fields.userLookups(fields.revealRow(table,row,{allowPlaintext:true}))),columns.push('EmailLookup','PhoneLookup');
                const assignments=columns.map(name=>`\`${name}\` = ?`);
                if(table!=='Notifications') assignments.push('UpdatedAt = UpdatedAt');
                await connection.execute(`UPDATE \`${table}\` SET ${assignments.join(', ')} WHERE \`${primary}\` = ?`,[...columns.map(name=>protectedRow[name]),row[primary]]);
            }
            await connection.commit();
            migrated+=rows.length;last=String(rows[rows.length-1][primary]);
        } catch(error){await connection.rollback();throw error;}
    }
    return migrated;
}
async function ensureLookupIndexes(connection) {
    const current=await indexes(connection);
    for(const [name,column] of [['UK_Users_EmailLookup','EmailLookup'],['UK_Users_PhoneLookup','PhoneLookup']]) {
        const existing=current.find(index=>index.name===name);
        if(existing) {
            if(!existing.unique || existing.columns.length!==1 || existing.columns[0]!==column) throw codeError('STORAGE_INCORRECT_LOOKUP_INDEX');
        } else await connection.query(`CREATE UNIQUE INDEX ${name} ON Users (${column})`);
    }
}
async function verifyStorage(connection,vault) {
    const plan=await planMigration(connection,vault);
    if(plan.pendingFields) throw codeError('STORAGE_PLAINTEXT_REMAINS');
    const fields=createDataFields(vault);
    let last='0';
    for(;;) {
        const [rows]=await connection.execute('SELECT UserId, Email, Phone, EmailLookup, PhoneLookup FROM Users WHERE UserId > ? ORDER BY UserId LIMIT 100',[last]);
        if(!rows.length) break;
        for(const row of rows) {
            const expected=fields.userLookups(fields.revealRow('Users',row));
            if(expected.EmailLookup!==row.EmailLookup || expected.PhoneLookup!==row.PhoneLookup) throw codeError('STORAGE_LOOKUP_MISMATCH');
        }
        last=String(rows[rows.length-1].UserId);
    }
    return plan;
}
async function runMigration(connection,{vault,apply=false,appStopped=false,backupDirectory=path.join(__dirname,'../.private/backups')}={}) {
    if(!vault) vault=require('../src/security/cryptoVault');
    if(apply && !appStopped) throw codeError('STORAGE_STOP_APP_BEFORE_APPLY');
    const fingerprint=keyCheck(vault);
    const storedCanary=await metadata(connection,'storage_canary');
    if(storedCanary && vault.open(storedCanary,'metadata:storage-v1')!=='storage-v1') throw codeError('STORAGE_KEY_MISMATCH');
    const storedKey=await metadata(connection,'storage_keycheck');
    if(storedKey && storedKey!==fingerprint) throw codeError('STORAGE_KEY_MISMATCH');
    const plan=await planMigration(connection,vault);
    if(!apply) return {status:'dry-run',...plan};
    const [[lock]]=await connection.execute('SELECT GET_LOCK(?, 0) AS acquired',['qldu.storage.v1']);
    if(Number(lock.acquired)!==1) throw codeError('STORAGE_MIGRATION_BUSY');
    try {
        if(await metadata(connection,'storage_v1')==='complete' && storedCanary && storedKey && !plan.pendingFields) {
            await verifyStorage(connection,vault);
            return {status:'already-complete',...plan};
        }
        // The backup preserves both original ciphertext and any legacy plaintext, encrypted
        // before any DDL or data mutation. Do not discard encryption keys or this before-image.
        const backup=await writeBackup(connection,vault,backupDirectory);
        await prepareSchema(connection);
        await setMetadata(connection,'storage_v1','in-progress');
        await setMetadata(connection,'storage_keycheck',fingerprint);
        await setMetadata(connection,'storage_canary',storedCanary || vault.seal('storage-v1','metadata:storage-v1'));
        for(const table of TABLES) await migrateTable(connection,table,vault);
        await connection.query('UPDATE Users SET OTPCode = NULL, OTPHash = NULL, OTPAttempts = 0, OTPExpiry = NULL, UpdatedAt = UpdatedAt');
        await ensureLookupIndexes(connection);
        const verified=await verifyStorage(connection,vault);
        await setMetadata(connection,'storage_v1','complete');
        return {status:'complete',...verified,backup};
    } finally { await connection.execute('SELECT RELEASE_LOCK(?)',['qldu.storage.v1']).catch(()=>{}); }
}
async function main() {
    require('dotenv').config({path:path.join(__dirname,'../.env')});
    const args=process.argv.slice(2);
    if(args.some(arg=>!['--dry-run','--apply','--confirm-app-stopped'].includes(arg))) throw codeError('STORAGE_INVALID_ARGUMENT');
    let connection;
    try {
        connection=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,supportBigNumbers:true,bigNumberStrings:true,ssl:databaseTlsOptions(),connectTimeout:5000});
        const result=await runMigration(connection,{apply:args.includes('--apply'),appStopped:args.includes('--confirm-app-stopped')});
        console.log(JSON.stringify(result));
    } finally {if(connection) await connection.end();}
}
if(require.main===module) main().catch(error=>{console.error('Storage migration failed:',/^[A-Z_0-9]+$/.test(error.code||'')?error.code:'STORAGE_MIGRATION_FAILED');process.exitCode=1;});
module.exports={runMigration,planMigration,verifyStorage,writeBackup,BACKUP_MAGIC};
