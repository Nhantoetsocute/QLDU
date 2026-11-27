const { isIP } = require('node:net');
const fs = require('node:fs');
const localHost = (hostname) => {
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1'
        || (isIP(host) === 4 && /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host));
};
const loopbackHost = host => ['localhost', '::1', '127.0.0.1'].includes(host || '');
function parseUrl(value, { production = false, originOnly = false } = {}) {
    if (typeof value !== 'string' || !value || /[\s\\]/.test(value)) throw new Error('Cấu hình URL không hợp lệ.');
    let url;
    try { url = new URL(value); } catch { throw new Error('Cấu hình URL không hợp lệ.'); }
    if (url.username || url.password || url.search || url.hash || (originOnly && url.pathname !== '/')) throw new Error('URL không được chứa credentials, query, fragment hoặc đường dẫn ngoài cấu hình.');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !production && localHost(url.hostname))) throw new Error('Yêu cầu URL HTTPS. HTTP chỉ dùng ở mạng cục bộ khi phát triển.');
    return url;
}
function configuredPublicOrigin(env = process.env) {
    if (env.PUBLIC_BASE_URL) return parseUrl(env.PUBLIC_BASE_URL, { production: env.NODE_ENV === 'production', originOnly: true }).origin;
    if (env.NODE_ENV === 'production') throw new Error('Production cần PUBLIC_BASE_URL HTTPS.');
    return null;
}
function getReturnUrl(req, env = process.env) {
    const origin = configuredPublicOrigin(env);
    return parseUrl(`${origin || require('./output').publicOrigin(req, env)}/api/sepay/return`, { production: env.NODE_ENV === 'production' }).href;
}
function trustedProxySetting(env = process.env) {
    if (!env.TRUST_PROXY) return false;
    const entries = env.TRUST_PROXY.split(',').map(value => value.trim());
    if (!entries.length || entries.some(value => {
        if (['loopback', 'linklocal', 'uniquelocal'].includes(value)) return false;
        const [address, prefix, extra] = value.split('/');
        const version = isIP(address);
        return !version || extra !== undefined || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)));
    })) throw new Error('TRUST_PROXY chỉ chấp nhận danh sách IP/subnet tin cậy, không dùng true hoặc số hop.');
    return entries;
}
function requireSecureTransport({ env = process.env } = {}) {
    return (req, res, next) => {
        // req.secure uses Express trust-proxy matching; never read X-Forwarded-Proto ourselves.
        if (env.NODE_ENV === 'production' && !req.secure) return res.status(426).json({ error: 'Yêu cầu kết nối HTTPS.' });
        return next();
    };
}
function databaseTlsOptions(env = process.env, readFile = fs.readFileSync) {
    const enabled = env.DB_TLS === 'true';
    if (env.DB_TLS !== undefined && env.DB_TLS !== '' && !['true', 'false'].includes(env.DB_TLS)) throw new Error('DB_TLS phải là true hoặc false.');
    if (!enabled) {
        if (env.NODE_ENV === 'production' && !loopbackHost(env.DB_HOST)) throw new Error('MySQL ngoài máy cần DB_TLS=true trong production.');
        return undefined;
    }
    // mysql2 does not send SNI/check the IP identity for IP literals. Use a DNS name covered by the certificate.
    if (env.NODE_ENV === 'production' && isIP(env.DB_HOST)) throw new Error('MySQL TLS production cần DB_HOST là tên DNS khớp chứng chỉ.');
    const ssl = { rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' };
    if (env.DB_SSL_CA) ssl.ca = readFile(env.DB_SSL_CA, 'utf8');
    return ssl;
}
function validateTransportConfig(env = process.env) {
    const origin = configuredPublicOrigin(env);
    trustedProxySetting(env);
    databaseTlsOptions(env);
    const sepayOrigin = new URL(require('../services/sepayService').checkoutUrl(env)).origin;
    if (env.NODE_ENV === 'production') getReturnUrl({ headers: {} }, env);
    for (const value of (env.CORS_ORIGINS || '').split(',').filter(Boolean)) parseUrl(value.trim(), { production: env.NODE_ENV === 'production', originOnly: true });
    return { publicOrigin: origin, sepayOrigin };
}
module.exports = { parseUrl, localHost, configuredPublicOrigin, getReturnUrl, trustedProxySetting, requireSecureTransport, databaseTlsOptions, validateTransportConfig };
