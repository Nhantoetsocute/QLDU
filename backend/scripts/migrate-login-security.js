require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const COLUMNS = [
    ['FailedLoginAttempts','SMALLINT UNSIGNED NOT NULL DEFAULT 0'],
    ['FirstFailedLoginAt','DATETIME NULL'],
    ['LastFailedLoginAt','DATETIME NULL'],
    ['LockedUntil','DATETIME NULL'],
    ['LoginLockDurationSeconds','INT UNSIGNED NOT NULL DEFAULT 0'],
];

async function applyLoginSecurityMigration(connection) {
    for (const [column,definition] of COLUMNS) {
        const [rows]=await connection.execute(
            'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            ['Users',column],
        );
        if (Number(rows[0].n)===0) await connection.query(`ALTER TABLE Users ADD COLUMN \`${column}\` ${definition}`);
    }
}

async function main() {
    const mysql=require('mysql2/promise');
    const {databaseTlsOptions}=require('../src/security/transport');
    const connection=await mysql.createConnection({
        host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,
        ssl:databaseTlsOptions(),connectTimeout:5000,
    });
    try { await applyLoginSecurityMigration(connection); }
    finally { await connection.end(); }
}

if(require.main===module) main().then(()=>console.log('Login security migration applied.')).catch(error=>{
    console.error('Login security migration failed:',error.code || 'DATABASE_ERROR');
    process.exitCode=1;
});

module.exports={applyLoginSecurityMigration,COLUMNS};
