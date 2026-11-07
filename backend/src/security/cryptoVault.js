const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_KEYS_FILE = path.join(__dirname, '../../.private/crypto-keys.json');
const MAX_BYTES = 16 * 1024 * 1024;
const KEY_ID = /^[A-Za-z0-9_-]{1,64}$/;

function failure(code = 'CRYPTO_OPERATION_FAILED') {
    const error = new Error('Không thể xử lý dữ liệu được bảo vệ.');
    error.code = code;
    return error;
}
function contextValue(value) {
    if (typeof value !== 'string' || !value.length || Buffer.byteLength(value) > 1024) throw failure('CRYPTO_CONTEXT_INVALID');
    return value;
}
function decodeBase64(value, expectedLength) {
    // Avoid repeated-group regexes: multi-megabyte avatar envelopes must not exhaust
    // the regexp engine stack. Canonical round-trip validation checks padding too.
    if (typeof value !== 'string' || value.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value)) throw failure('CRYPTO_KEY_INVALID');
    const decoded = Buffer.from(value, 'base64');
    if (decoded.toString('base64') !== value || (expectedLength !== undefined && decoded.length !== expectedLength)) throw failure('CRYPTO_KEY_INVALID');
    return decoded;
}
function framed(...values) {
    const parts = [];
    for (const value of values) {
        const data = Buffer.from(value, 'utf8');
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length);
        parts.push(length, data);
    }
    return Buffer.concat(parts);
}
function isEncrypted(value) {
    return typeof value === 'string' ? value.startsWith('qldu:')
        : Buffer.isBuffer(value) && value.subarray(0, 5).toString('ascii') === 'qldu:';
}
function createVault(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config) || config.version !== 1
        || typeof config.activeKeyId !== 'string' || !KEY_ID.test(config.activeKeyId)
        || !config.encryptionKeys || typeof config.encryptionKeys !== 'object' || Array.isArray(config.encryptionKeys)) throw failure('CRYPTO_CONFIG_INVALID');
    const entries = Object.entries(config.encryptionKeys);
    if (!entries.length || entries.length > 256 || entries.some(([id]) => !KEY_ID.test(id))) throw failure('CRYPTO_CONFIG_INVALID');
    const encryptionKeys = new Map(entries.map(([id, value]) => [id, decodeBase64(value, 32)]));
    if (!encryptionKeys.has(config.activeKeyId)) throw failure('CRYPTO_ACTIVE_KEY_MISSING');
    const otpKey = decodeBase64(config.otpKey, 32);
    const indexKey = decodeBase64(config.indexKey, 32);
    const allKeys = [...encryptionKeys.values(), otpKey, indexKey];
    if (new Set(allKeys.map(key => key.toString('hex'))).size !== allKeys.length) throw failure('CRYPTO_KEYS_MUST_DIFFER');
    const activeKeyId = config.activeKeyId;

    function sealBytes(value, context) {
        contextValue(context);
        if (!Buffer.isBuffer(value) || value.length > MAX_BYTES) throw failure('CRYPTO_VALUE_INVALID');
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKeys.get(activeKeyId), iv, { authTagLength: 16 });
        cipher.setAAD(framed('qldu:v1', activeKeyId, context));
        const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
        const envelope = ['qldu', 'v1', activeKeyId, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
        return Buffer.from(envelope, 'ascii');
    }
    function openBytes(value, context) {
        contextValue(context);
        if (!Buffer.isBuffer(value) || value.length > Math.ceil(MAX_BYTES * 4 / 3) + 256) throw failure('CRYPTO_VALUE_INVALID');
        try {
            const source = value.toString('ascii');
            if (!Buffer.from(source, 'ascii').equals(value)) throw failure();
            const parts = source.split(':');
            if (parts.length !== 6 || parts[0] !== 'qldu' || parts[1] !== 'v1' || !KEY_ID.test(parts[2])) throw failure();
            const [, , keyId, encodedIv, encodedTag, encodedCiphertext] = parts;
            const key = encryptionKeys.get(keyId);
            if (!key) throw failure();
            const iv = decodeBase64(encodedIv, 12);
            const tag = decodeBase64(encodedTag, 16);
            const ciphertext = decodeBase64(encodedCiphertext);
            if (ciphertext.length > MAX_BYTES) throw failure();
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
            decipher.setAAD(framed('qldu:v1', keyId, context));
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        } catch { throw failure('CRYPTO_AUTH_FAILED'); }
    }
    function seal(value, context) {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'string') throw failure('CRYPTO_VALUE_INVALID');
        return sealBytes(Buffer.from(value, 'utf8'), context).toString('ascii');
    }
    function open(value, context) {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'string') throw failure('CRYPTO_VALUE_INVALID');
        const bytes = openBytes(Buffer.from(value, 'utf8'), context);
        const text = bytes.toString('utf8');
        if (!Buffer.from(text, 'utf8').equals(bytes)) throw failure('CRYPTO_AUTH_FAILED');
        return text;
    }
    function blindIndex(value, purpose) {
        contextValue(purpose);
        if (typeof value !== 'string' || Buffer.byteLength(value) > MAX_BYTES) throw failure('CRYPTO_VALUE_INVALID');
        return crypto.createHmac('sha256', indexKey).update(framed('qldu:index:v1', purpose, value)).digest('hex');
    }
    function otpParts(userId, expiry, otp) {
        const identifier = typeof userId === 'number' ? userId : typeof userId === 'string' && /^[1-9]\d{0,14}$/.test(userId) ? Number(userId) : NaN;
        const expiresAt = expiry instanceof Date ? expiry.getTime() : (typeof expiry === 'string' && expiry.length || typeof expiry === 'number') ? new Date(expiry).getTime() : NaN;
        if (!Number.isSafeInteger(identifier) || identifier < 1 || !Number.isFinite(expiresAt)
            || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) throw failure('CRYPTO_OTP_INVALID');
        return { identifier, expiresAt };
    }
    function otpDigest(userId, expiry, otp) {
        const { identifier, expiresAt } = otpParts(userId, expiry, otp);
        return crypto.createHmac('sha256', otpKey).update(framed('qldu:otp:v1', String(identifier), String(expiresAt), otp)).digest('hex');
    }
    function verifyOtpDigest(userId, expiry, otp, digest) {
        try {
            const { expiresAt } = otpParts(userId, expiry, otp);
            if (expiresAt <= Date.now() || typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) return false;
            return crypto.timingSafeEqual(Buffer.from(otpDigest(userId, expiry, otp), 'hex'), Buffer.from(digest, 'hex'));
        } catch { return false; }
    }
    return { seal, open, sealBytes, openBytes, isEncrypted, blindIndex, otpDigest, verifyOtpDigest, validateKeys: () => true };
}

function keysFile(env = process.env) {
    if (env.CRYPTO_KEYS_FILE !== undefined && (typeof env.CRYPTO_KEYS_FILE !== 'string' || !env.CRYPTO_KEYS_FILE || /[\x00-\x1f\x7f]/.test(env.CRYPTO_KEYS_FILE))) throw failure('CRYPTO_KEYS_PATH_INVALID');
    return env.CRYPTO_KEYS_FILE ? path.resolve(env.CRYPTO_KEYS_FILE) : DEFAULT_KEYS_FILE;
}
function checkPrivateDirectory(directory) {
    const info = fs.lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o700
        || (process.getuid && info.uid !== process.getuid())) throw failure('CRYPTO_KEYS_PERMISSIONS');
}
function readKeyringFile(filename) {
    let fd;
    try {
        checkPrivateDirectory(path.dirname(filename));
        const before = fs.lstatSync(filename);
        if (!before.isFile() || before.isSymbolicLink()) throw failure('CRYPTO_KEYS_PERMISSIONS');
        fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        const info = fs.fstatSync(fd);
        if (!info.isFile() || info.dev !== before.dev || info.ino !== before.ino || (info.mode & 0o777) !== 0o600 || info.size > 65536
            || (process.getuid && info.uid !== process.getuid())) throw failure('CRYPTO_KEYS_PERMISSIONS');
        return JSON.parse(fs.readFileSync(fd, 'utf8'));
    } catch (error) {
        if (error.code?.startsWith('CRYPTO_')) throw error;
        throw failure(error.code === 'ENOENT' ? 'CRYPTO_KEYS_NOT_CONFIGURED' : 'CRYPTO_KEYS_UNREADABLE');
    } finally { if (fd !== undefined) fs.closeSync(fd); }
}
function loadConfig(env = process.env) {
    const names = ['DATA_ENCRYPTION_KEYS', 'DATA_ENCRYPTION_ACTIVE_KEY_ID', 'OTP_HMAC_KEY', 'DATA_INDEX_KEY'];
    if (names.some(name => env[name] !== undefined)) {
        if (names.some(name => typeof env[name] !== 'string' || !env[name])) throw failure('CRYPTO_ENV_INCOMPLETE');
        let encryptionKeys;
        try { encryptionKeys = JSON.parse(env.DATA_ENCRYPTION_KEYS); } catch { throw failure('CRYPTO_CONFIG_INVALID'); }
        return { version: 1, activeKeyId: env.DATA_ENCRYPTION_ACTIVE_KEY_ID, encryptionKeys, otpKey: env.OTP_HMAC_KEY, indexKey: env.DATA_INDEX_KEY };
    }
    return readKeyringFile(keysFile(env));
}
let defaultVault;
const current = () => defaultVault || (defaultVault = createVault(loadConfig()));
module.exports = { createVault, isEncrypted, keysFile, readKeyringFile, checkPrivateDirectory, loadConfig, DEFAULT_KEYS_FILE };
for (const method of ['seal', 'open', 'sealBytes', 'openBytes', 'blindIndex', 'otpDigest', 'verifyOtpDigest', 'validateKeys']) {
    module.exports[method] = (...args) => current()[method](...args);
}
