const { createHash } = require('node:crypto');

const COMMON_PASSWORDS = new Set([
    '123456', '1234567', '12345678', '123456789', '1234567890',
    'password', 'password1', 'password123', 'password1234', 'password!',
    'password1!', 'admin', 'admin123', 'administrator', 'qwerty',
    'qwerty123', 'qwertyuiop', 'letmein', 'welcome', 'welcome1',
    'iloveyou', 'sunshine', 'princess', 'football', 'monkey',
    'dragon', 'master', 'login', 'abc123', 'abcd1234', '111111',
    '11111111', '000000', '00000000', '123123', '654321',
    'passw0rd', 'trustno1', 'whatever', 'zaq12wsx', '1q2w3e4r',
    'Password1!', 'P@ssw0rd', 'P@ssword123',
]);

const PWNED_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 32;
const prefixCache = new Map();

class PasswordPolicyError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.status = code === 'PASSWORD_CHECK_UNAVAILABLE' ? 503 : 400;
    }
}

function isCommonPassword(password) {
    return typeof password === 'string' && COMMON_PASSWORDS.has(password.toLowerCase());
}

async function pwnedSuffixes(prefix, { fetchImpl = globalThis.fetch, timeoutMs = 2500, now = Date.now } = {}) {
    const cached = prefixCache.get(prefix);
    if (cached && cached.expiresAt > now()) return cached.suffixes;
    if (typeof fetchImpl !== 'function') throw new PasswordPolicyError('PASSWORD_CHECK_UNAVAILABLE', 'Chưa thể kiểm tra an toàn mật khẩu. Vui lòng thử lại.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: { 'Add-Padding': 'true', 'User-Agent': 'QLDU-Password-Policy/1.0' },
            signal: controller.signal,
        });
        if (!response.ok) throw new Error('Password check unavailable');
        const body = await response.text();
        const suffixes = new Set();
        let records = 0;
        for (const line of body.split(/\r?\n/)) {
            const value=line.trim();
            if (!value) continue;
            const match = /^([A-F0-9]{35}):\d+$/i.exec(value);
            if (!match) throw new Error('Invalid password check response');
            suffixes.add(match[1].toUpperCase());
            records++;
        }
        if (!records) throw new Error('Empty password check response');
        if (prefixCache.size >= MAX_CACHE_ENTRIES) prefixCache.delete(prefixCache.keys().next().value);
        prefixCache.set(prefix, { suffixes, expiresAt: now() + PWNED_CACHE_TTL_MS });
        return suffixes;
    } catch {
        throw new PasswordPolicyError('PASSWORD_CHECK_UNAVAILABLE', 'Chưa thể kiểm tra an toàn mật khẩu. Vui lòng thử lại.');
    } finally {
        clearTimeout(timeout);
    }
}

async function assertPasswordAllowed(password, options) {
    if (isCommonPassword(password)) {
        throw new PasswordPolicyError('WEAK_PASSWORD', 'Mật khẩu này quá phổ biến và dễ bị đoán. Vui lòng chọn mật khẩu khác để bảo vệ tài khoản.');
    }
    const digest = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = digest.slice(0, 5);
    if ((await pwnedSuffixes(prefix, options)).has(digest.slice(5))) {
        throw new PasswordPolicyError('WEAK_PASSWORD', 'Mật khẩu này đã xuất hiện trong dữ liệu rò rỉ. Vui lòng chọn mật khẩu khác để bảo vệ tài khoản.');
    }
}

module.exports = { assertPasswordAllowed, isCommonPassword, PasswordPolicyError };
