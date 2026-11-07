const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { keysFile, readKeyringFile, checkPrivateDirectory, createVault } = require('../src/security/cryptoVault');

function initialize(filename = keysFile()) {
    const directory = path.dirname(filename);
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        fs.chmodSync(directory, 0o700);
    }
    checkPrivateDirectory(directory);
    if (fs.existsSync(filename)) {
        createVault(readKeyringFile(filename));
        return filename;
    }
    const config = {
        version: 1,
        activeKeyId: 'local-v1',
        encryptionKeys: { 'local-v1': randomBytes(32).toString('base64') },
        otpKey: randomBytes(32).toString('base64'),
        indexKey: randomBytes(32).toString('base64'),
    };
    createVault(config);
    let fd;
    try {
        fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
        fs.fchmodSync(fd, 0o600);
        fs.writeFileSync(fd, JSON.stringify(config, null, 2) + '\n');
        fs.fsyncSync(fd);
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        createVault(readKeyringFile(filename));
    } finally { if (fd !== undefined) fs.closeSync(fd); }
    return filename;
}
if (require.main === module) {
    try { console.log(initialize()); }
    catch { console.error('Không thể khởi tạo keyring riêng tư. Kiểm tra đường dẫn và quyền 700/600.'); process.exitCode = 1; }
}
module.exports = { initialize };
