const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createVault, isEncrypted, loadConfig, readKeyringFile, keysFile } = require('../src/security/cryptoVault');
const { initialize } = require('../scripts/init-crypto');

const key = () => crypto.randomBytes(32).toString('base64');
function config() {
    return { version: 1, activeKeyId: 'test-v1', encryptionKeys: { 'test-v1': key() }, otpKey: key(), indexKey: key() };
}
function directory(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qldu-crypto-test-'));
    fs.chmodSync(dir, 0o700);
    t.after(() => fs.rmSync(dir, { force: true, recursive: true }));
    return dir;
}

test('authenticated encryption preserves nullable, empty and Unicode values without exposing plaintext', () => {
    const vault = createVault(config());
    for (const value of ['', '0901234567', 'Nguyễn Văn A — địa chỉ riêng']) {
        const encrypted = vault.seal(value, 'Users.Phone:7');
        assert.equal(isEncrypted(encrypted), true);
        assert.equal(vault.open(encrypted, 'Users.Phone:7'), value);
        if (value) assert.ok(!encrypted.includes(value));
    }
    assert.equal(vault.seal(null, 'Users.Phone:7'), null);
    assert.equal(vault.open(null, 'Users.Phone:7'), null);
    assert.equal(vault.seal(undefined, 'Users.Phone:7'), null);
    assert.throws(() => vault.open('plaintext-phone', 'Users.Phone:7'), { code: 'CRYPTO_AUTH_FAILED' });
});

test('fresh random 96-bit IVs make identical plaintext encrypt differently', () => {
    const vault = createVault(config());
    const first = vault.seal('private', 'Users.Address:7');
    const second = vault.seal('private', 'Users.Address:7');
    assert.notEqual(first, second);
    assert.equal(Buffer.from(first.split(':')[3], 'base64').length, 12);
    assert.equal(Buffer.from(first.split(':')[4], 'base64').length, 16);
});

test('record, field and framing boundaries are authenticated so copying ciphertext is rejected', () => {
    const vault = createVault(config());
    const encrypted = vault.seal('private', 'Users.Phone:7');
    for (const context of ['Users.Phone:8', 'Orders.ReceiverPhone:7', 'Users.Phone:7:']) {
        assert.throws(() => vault.open(encrypted, context), { code: 'CRYPTO_AUTH_FAILED' });
    }
});

test('changes to IV, tag or ciphertext fail closed without returning partial plaintext', () => {
    const vault = createVault(config());
    const encrypted = vault.seal('private phone data', 'Users.Phone:7');
    for (const index of [3, 4, 5]) {
        const pieces = encrypted.split(':');
        const bytes = Buffer.from(pieces[index], 'base64');
        bytes[0] ^= 1;
        pieces[index] = bytes.toString('base64');
        assert.throws(() => vault.open(pieces.join(':'), 'Users.Phone:7'), { code: 'CRYPTO_AUTH_FAILED' });
    }
});

test('version and key ID are validated and authenticated', () => {
    const c = config();
    c.encryptionKeys['test-v2'] = key();
    const vault = createVault(c);
    const encrypted = vault.seal('private', 'Users.Name:7');
    for (const changed of [encrypted.replace(':v1:', ':v2:'), encrypted.replace(':test-v1:', ':test-v2:'), encrypted.replace(':test-v1:', ':missing:')]) {
        assert.equal(isEncrypted(changed), true);
        assert.throws(() => vault.open(changed, 'Users.Name:7'), { code: 'CRYPTO_AUTH_FAILED' });
    }
});

test('rotation encrypts with the new active key while retaining old data decryption', () => {
    const original = config();
    const first = createVault(original).seal('existing record', 'Users.Address:7');
    const rotated = { ...original, activeKeyId: 'test-v2', encryptionKeys: { ...original.encryptionKeys, 'test-v2': key() } };
    const vault = createVault(rotated);
    assert.equal(vault.open(first, 'Users.Address:7'), 'existing record');
    assert.match(vault.seal('new record', 'Users.Address:7'), /^qldu:v1:test-v2:/);
    delete rotated.encryptionKeys['test-v1'];
    assert.throws(() => createVault(rotated).open(first, 'Users.Address:7'), { code: 'CRYPTO_AUTH_FAILED' });
});

test('binary encryption supports full 5MB avatar data and does not coerce bytes through UTF-8', () => {
    const vault = createVault(config());
    const source = Buffer.alloc(5 * 1024 * 1024);
    for (let i = 0; i < 256; i++) source[i] = i;
    const encrypted = vault.sealBytes(source, 'avatars:7:opaque-file');
    assert.ok(Buffer.isBuffer(encrypted));
    assert.equal(isEncrypted(encrypted), true);
    assert.deepEqual(vault.openBytes(encrypted, 'avatars:7:opaque-file'), source);
    assert.throws(() => vault.openBytes(source, 'avatars:7:opaque-file'), { code: 'CRYPTO_AUTH_FAILED' });
});

test('malformed envelopes, base64 and contexts are rejected', () => {
    const vault = createVault(config());
    const encrypted = vault.seal('data', 'context');
    for (const value of ['', 'qldu:v1', `${encrypted}:extra`, encrypted.replace(':v1:', ':v3:'), encrypted.replace(/.$/, '!')]) {
        assert.throws(() => vault.open(value, 'context'), { code: 'CRYPTO_AUTH_FAILED' });
    }
    for (const context of ['', null, {}, 'x'.repeat(1025)]) assert.throws(() => vault.seal('data', context), { code: 'CRYPTO_CONTEXT_INVALID' });
    assert.throws(() => vault.seal(123, 'context'), { code: 'CRYPTO_VALUE_INVALID' });
});

test('keyring validation rejects malformed keys, missing active keys and key reuse across purposes', () => {
    for (const change of [
        c => { c.version = 2; },
        c => { c.activeKeyId = 'missing'; },
        c => { c.encryptionKeys = {}; },
        c => { c.encryptionKeys = { 'bad:key': key() }; },
        c => { c.otpKey = crypto.randomBytes(31).toString('base64'); },
        c => { c.otpKey = ' ' + c.otpKey; },
        c => { c.indexKey = c.otpKey; },
        c => { c.indexKey = c.encryptionKeys['test-v1']; },
        c => { c.encryptionKeys['test-v2'] = c.encryptionKeys['test-v1']; },
    ]) {
        const c = config(); change(c);
        assert.throws(() => createVault(c));
    }
});

test('blind indexes are deterministic but keyed and domain-separated', () => {
    const c = config();
    const vault = createVault(c);
    const value = 'person@example.invalid';
    const digest = vault.blindIndex(value, 'Users.Email');
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(digest, vault.blindIndex(value, 'Users.Email'));
    assert.notEqual(digest, vault.blindIndex(value, 'Users.Phone'));
    assert.notEqual(digest, createVault({ ...c, indexKey: key() }).blindIndex(value, 'Users.Email'));
    assert.notEqual(digest, crypto.createHash('sha256').update(value).digest('hex'));
});

test('OTP digests are keyed, constant-length and bound to account, expiry and submitted code', () => {
    const c = config();
    const vault = createVault(c);
    const expiry = new Date(Date.now() + 60000);
    const digest = vault.otpDigest(7, expiry, '123456');
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(vault.verifyOtpDigest(7, expiry, '123456', digest), true);
    assert.equal(vault.verifyOtpDigest('7', expiry.toISOString(), '123456', digest), true);
    assert.equal(vault.verifyOtpDigest(8, expiry, '123456', digest), false);
    assert.equal(vault.verifyOtpDigest(7, new Date(expiry.getTime() + 1), '123456', digest), false);
    assert.equal(vault.verifyOtpDigest(7, expiry, '654321', digest), false);
    assert.equal(createVault({ ...c, otpKey: key() }).verifyOtpDigest(7, expiry, '123456', digest), false);
    assert.equal(vault.verifyOtpDigest(7, expiry, '123456', '123456'), false);
});

test('OTP verification rejects expired, malformed and non-string values', () => {
    const vault = createVault(config());
    const expiry = new Date(Date.now() - 1);
    const digest = vault.otpDigest(7, expiry, '123456');
    assert.equal(vault.verifyOtpDigest(7, expiry, '123456', digest), false);
    for (const code of [123456, '12345', null, '1234567']) assert.equal(vault.verifyOtpDigest(7, new Date(Date.now() + 1000), code, digest), false);
    assert.equal(vault.verifyOtpDigest(7, 'invalid date', '123456', digest), false);
});

test('environment configuration is atomic and never uses the JWT secret as an encryption fallback', t => {
    const c = config();
    const env = { DATA_ENCRYPTION_KEYS: JSON.stringify(c.encryptionKeys), DATA_ENCRYPTION_ACTIVE_KEY_ID: c.activeKeyId, OTP_HMAC_KEY: c.otpKey, DATA_INDEX_KEY: c.indexKey };
    assert.equal(createVault(loadConfig(env)).validateKeys(), true);
    assert.throws(() => loadConfig({ DATA_ENCRYPTION_KEYS: env.DATA_ENCRYPTION_KEYS }), { code: 'CRYPTO_ENV_INCOMPLETE' });
    assert.throws(() => loadConfig({ JWT_SECRET: 'strong-but-unrelated-jwt-secret', CRYPTO_KEYS_FILE: path.join(directory(t), 'missing.json') }), { code: 'CRYPTO_KEYS_NOT_CONFIGURED' });
    assert.throws(() => keysFile({ CRYPTO_KEYS_FILE: 'bad\npath' }), { code: 'CRYPTO_KEYS_PATH_INVALID' });
});

test('local keyring requires private directory and file permissions and never follows symlinks', t => {
    const dir = directory(t);
    const filename = path.join(dir, 'keys.json');
    fs.writeFileSync(filename, JSON.stringify(config()), { mode: 0o600 });
    assert.equal(createVault(readKeyringFile(filename)).validateKeys(), true);
    fs.chmodSync(filename, 0o644);
    assert.throws(() => readKeyringFile(filename), { code: 'CRYPTO_KEYS_PERMISSIONS' });
    fs.chmodSync(filename, 0o600);
    fs.chmodSync(dir, 0o755);
    assert.throws(() => readKeyringFile(filename), { code: 'CRYPTO_KEYS_PERMISSIONS' });
    fs.chmodSync(dir, 0o700);
    const linked = path.join(dir, 'linked.json'); fs.symlinkSync(filename, linked);
    assert.throws(() => readKeyringFile(linked));
    const parent = directory(t); const linkedDir = path.join(parent, 'linked'); fs.symlinkSync(dir, linkedDir);
    assert.throws(() => readKeyringFile(path.join(linkedDir, 'keys.json')), { code: 'CRYPTO_KEYS_PERMISSIONS' });
});

test('key initializer is idempotent, creates 700/600 private storage and never overwrites existing key material', t => {
    const base = directory(t);
    const filename = path.join(base, '.private', 'crypto-keys.json');
    assert.equal(initialize(filename), filename);
    assert.equal(fs.statSync(path.dirname(filename)).mode & 0o777, 0o700);
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
    const first = fs.readFileSync(filename);
    const c = readKeyringFile(filename);
    assert.equal(c.activeKeyId, 'local-v1');
    assert.equal(createVault(c).validateKeys(), true);
    assert.equal(initialize(filename), filename);
    assert.deepEqual(fs.readFileSync(filename), first);
    fs.writeFileSync(filename, 'invalid existing file', { mode: 0o600 });
    assert.throws(() => initialize(filename));
    assert.equal(fs.readFileSync(filename, 'utf8'), 'invalid existing file');
});
