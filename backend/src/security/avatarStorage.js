const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const MAX_STORED_BYTES = 8 * 1024 * 1024;
const NAME = /^avatar_[1-9]\d{0,14}_[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/;
const avatarContext = filename => {
    if (typeof filename !== 'string' || !NAME.test(filename)) throw new Error('Invalid avatar filename');
    return `avatar:${filename}`;
};
async function secureDirectory(directory) {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await fs.lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe avatar directory');
    await fs.chmod(directory, 0o700);
}
async function readStoredAvatar(directory, filename) {
    avatarContext(filename);
    const info = await fs.lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe avatar directory');
    const target = path.join(directory, filename);
    const before = await fs.lstat(target);
    if (!before.isFile() || before.isSymbolicLink()) { const error = new Error('Invalid avatar path'); error.code = 'AVATAR_NOT_FOUND'; throw error; }
    // NONBLOCK prevents a concurrent replacement by a FIFO from hanging the process.
    const file = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
    try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino) { const error=new Error('Invalid avatar path'); error.code='AVATAR_NOT_FOUND'; throw error; }
        if (stat.size > MAX_STORED_BYTES || stat.size < 1) throw new Error('Invalid avatar file');
        return await file.readFile();
    } finally { await file.close(); }
}
async function writeEncryptedAvatar(directory, filename, bytes, { sealBytes = (...args) => require('./cryptoVault').sealBytes(...args) } = {}) {
    await secureDirectory(directory);
    const encrypted = sealBytes(bytes, avatarContext(filename));
    if (!Buffer.isBuffer(encrypted) || encrypted.length > MAX_STORED_BYTES) throw new Error('Encrypted avatar too large');
    const destination = path.join(directory, filename);
    await fs.writeFile(destination, encrypted, { mode: 0o600, flag: 'wx' });
    return destination;
}
async function replaceEncryptedAvatar(directory, filename, encrypted) {
    avatarContext(filename);
    if (!Buffer.isBuffer(encrypted) || encrypted.length > MAX_STORED_BYTES) throw new Error('Encrypted avatar too large');
    await secureDirectory(directory);
    const target = path.join(directory, filename);
    const info = await fs.lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe avatar target');
    const temporary = path.join(directory, `.encrypt-${randomBytes(16).toString('hex')}.tmp`);
    try {
        const handle = await fs.open(temporary, 'wx', 0o600);
        try { await handle.writeFile(encrypted); await handle.sync(); } finally { await handle.close(); }
        await fs.rename(temporary, target);
        await fs.chmod(target, 0o600);
    } finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
module.exports = { avatarContext, secureDirectory, readStoredAvatar, writeEncryptedAvatar, replaceEncryptedAvatar, MAX_STORED_BYTES, NAME };
