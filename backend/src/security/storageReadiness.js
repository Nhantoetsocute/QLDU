const vault = require('./cryptoVault');
async function assertStorageReady(pool) {
    vault.validateKeys();
    const [loginColumns]=await pool.execute(
        "SELECT COUNT(DISTINCT COLUMN_NAME) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users' AND COLUMN_NAME IN ('FailedLoginAttempts','FirstFailedLoginAt','LastFailedLoginAt','LockedUntil','LoginLockDurationSeconds')",
    );
    if(Number(loginColumns[0]?.n)!==5) {
        const error=new Error('Login security migration required.');error.code='LOGIN_SECURITY_MIGRATION_REQUIRED';throw error;
    }
    const [rows]=await pool.execute("SELECT MetaKey, MetaValue FROM AppSecurityMetadata WHERE MetaKey IN ('storage_v1','storage_keycheck','storage_canary')");
    const metadata=Object.fromEntries(rows.map(row=>[row.MetaKey,row.MetaValue]));
    if (metadata.storage_v1!=='complete' || metadata.storage_keycheck!==vault.blindIndex('storage-v1','storage.metadata')
        || vault.open(metadata.storage_canary,'metadata:storage-v1')!=='storage-v1') {
        const error=new Error('Storage migration/key verification required.');error.code='STORAGE_NOT_READY';throw error;
    }
}
module.exports={assertStorageReady};
