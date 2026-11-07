const test = require('node:test');
const assert = require('node:assert/strict');
const {
    configuredPublicOrigin, getReturnUrl, trustedProxySetting,
    requireSecureTransport, databaseTlsOptions, validateTransportConfig,
} = require('../src/security/transport');
const { apiOrigin, apiPath } = require('../../src/config/transport');

const production = {
    NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://api.example.com', DB_HOST: '127.0.0.1',
    VNP_RETURN_URL: 'https://api.example.com/api/vnpay/return', TRUST_PROXY: 'loopback',
};
test('production origin requires actual HTTPS and rejects credentials, query, fragment and path', () => {
    assert.equal(configuredPublicOrigin(production), 'https://api.example.com');
    for (const value of ['', 'http://api.example.com', 'https://user:pass@api.example.com', 'https://api.example.com/a', 'https://api.example.com?secret=1', 'https://api.example.com#fragment', 'https://api.example.com\\path']) {
        assert.throws(() => configuredPublicOrigin({ ...production, PUBLIC_BASE_URL: value }));
    }
});
test('VNPay return must match the configured production origin and expected route', () => {
    assert.equal(getReturnUrl({}, production), production.VNP_RETURN_URL);
    for (const value of ['http://api.example.com/api/vnpay/return', 'https://attacker.example/api/vnpay/return', 'https://api.example.com/other', 'https://api.example.com/api/vnpay/return?x=1']) {
        assert.throws(() => getReturnUrl({}, { ...production, VNP_RETURN_URL: value }));
    }
    assert.equal(validateTransportConfig(production).vnpayOrigin, 'https://sandbox.vnpayment.vn');
    for (const host of ['http://sandbox.vnpayment.vn', 'https://vnpay.attacker.example', 'https://sandbox.vnpayment.vn:444']) assert.throws(() => validateTransportConfig({ ...production, VNP_HOST: host }));
});
test('proxy configuration rejects trust-all and hop count modes', () => {
    assert.equal(trustedProxySetting({}), false);
    assert.deepEqual(trustedProxySetting({ TRUST_PROXY: 'loopback,10.0.0.4/32' }), ['loopback', '10.0.0.4/32']);
    for (const value of ['true', '1', '0.0.0.0/0', '::/0', '10.0.0.1/33', '127.0.0.1,']) assert.throws(() => trustedProxySetting({ TRUST_PROXY: value }));
});
test('production requests cannot bypass HTTPS with an untrusted forwarded header', () => {
    const middleware = requireSecureTransport({ env: production });
    let accepted = 0, status;
    const res = { status(code) { status = code; return this; }, json() {} };
    middleware({ secure: false, headers: { 'x-forwarded-proto': 'https' } }, res, () => accepted++);
    assert.equal(status, 426); assert.equal(accepted, 0);
    middleware({ secure: true }, res, () => accepted++); assert.equal(accepted, 1);
    requireSecureTransport({ env: {} })({ secure: false }, res, () => accepted++); assert.equal(accepted, 2);
});
test('remote MySQL production connections require TLS certificate and DNS identity verification', () => {
    assert.equal(databaseTlsOptions(production), undefined);
    assert.throws(() => databaseTlsOptions({ ...production, DB_HOST: 'db.example.com' }));
    assert.throws(() => databaseTlsOptions({ ...production, DB_HOST: '203.0.113.8', DB_TLS: 'true' }));
    assert.deepEqual(databaseTlsOptions({ ...production, DB_HOST: 'db.example.com', DB_TLS: 'true' }), { rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' });
    assert.equal(databaseTlsOptions({ DB_TLS: 'true', DB_SSL_CA: '/test/ca.pem' }, () => 'test-ca').ca, 'test-ca');
});
test('frontend API origin rejects malformed and nonlocal cleartext URLs while retaining local development', () => {
    assert.equal(apiOrigin('https://api.example.com/'), 'https://api.example.com');
    assert.equal(apiOrigin('http://192.168.1.20:3000', { development: true }), 'http://192.168.1.20:3000');
    for (const value of ['http://api.example.com', 'https://user:pass@api.example.com', 'https://api.example.com/path', 'https://api.example.com?x=1', 'https://api.example.com#x']) assert.throws(() => apiOrigin(value));
    for (const value of ['http://10.attacker.example', 'http://127.attacker.example', 'http://public.example']) assert.throws(() => apiOrigin(value, { development: true }));
    assert.throws(() => apiOrigin('http://localhost:3000'));
});
test('API paths cannot switch origin or inject a URL fragment', () => {
    assert.equal(apiPath('https://api.example.com', '/api/orders?page=2'), 'https://api.example.com/api/orders?page=2');
    for (const path of ['https://attacker.example', '//attacker.example/path', '/\\attacker.example/path', '/api/orders#secret', '/api/ bad']) assert.throws(() => apiPath('https://api.example.com', path));
});
test('native default config blocks cleartext while explicitly marked development config permits it', () => {
    const previous = process.env.APP_VARIANT;
    try {
        delete process.env.APP_VARIANT;
        const config = require('../../app.config')();
        assert.equal(config.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
        assert.equal(config.plugins.at(-1)[1].development, false);
        process.env.APP_VARIANT = 'development';
        const development = require('../../app.config')();
        assert.equal(development.ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking, true);
        assert.equal(development.plugins.at(-1)[1].development, true);
    } finally { if (previous === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = previous; }
});

test('Express production transport rejects spoofed forwarded HTTPS from untrusted peers', async t => {
    const express = require('express');
    const http = require('node:http');
    async function start(trust) {
        const app=express();
        app.set('trust proxy',trustedProxySetting({TRUST_PROXY:trust}));
        app.use(requireSecureTransport({env:{NODE_ENV:'production'}}));
        app.get('/probe',(req,res)=>res.json({ok:true}));
        const server=http.createServer(app);
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
        t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
        return `http://127.0.0.1:${server.address().port}/probe`;
    }
    const untrusted=await start('203.0.113.5');
    assert.equal((await fetch(untrusted,{headers:{'X-Forwarded-Proto':'https'}})).status,426);
    const trusted=await start('loopback');
    assert.equal((await fetch(trusted)).status,426);
    assert.equal((await fetch(trusted,{headers:{'X-Forwarded-Proto':'https'}})).status,200);
});
