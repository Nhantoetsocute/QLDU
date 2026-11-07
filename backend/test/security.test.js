const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { getSecret, signToken, verifyToken, validPassword } = require('../src/config/auth');
const createLimit = require('../src/middleware/authRateLimit');

test('JWT refuses weak secrets and tokens with wrong audience, algorithm or expiry', () => {
    const old = process.env.JWT_SECRET;
    try {
        process.env.JWT_SECRET = 'secret';
        assert.throws(getSecret);
        process.env.JWT_SECRET = 'unit-test-key-for-security-at-least-32-bytes';
        assert.equal(verifyToken(signToken({ userId: 7 })).userId, 7);
        for (const options of [
            { algorithm: 'HS384', audience: 'qldu-app', issuer: 'qldu-api' },
            { audience: 'other', issuer: 'qldu-api' },
            { audience: 'qldu-app', issuer: 'qldu-api', expiresIn: -1 },
        ]) assert.throws(() => verifyToken(jwt.sign({ userId: 7 }, getSecret(), options)));
    } finally {
        if (old === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = old;
    }
});

test('password policy rejects short inputs, nonstrings and bcrypt truncation', () => {
    assert.equal(validPassword('short'), false);
    assert.equal(validPassword({ length: 20 }), false);
    assert.equal(validPassword('a'.repeat(73)), false);
    assert.equal(validPassword('ế'.repeat(30)), false);
    assert.equal(validPassword('a long passphrase'), true);
});

test('auth limiter blocks bursts, separates IPs and expires entries', () => {
    let time = 100;
    const limit = createLimit({ limit: 2, windowMs: 1000, now: () => time });
    let passes = 0;
    let blocked = 0;
    const res = { set() {}, status(code) { assert.equal(code, 429); blocked++; return this; }, json() {} };
    const call = (ip) => limit({ ip }, res, () => passes++);
    call('a'); call('a'); call('a'); call('b');
    assert.equal(passes, 3);
    assert.equal(blocked, 1);
    time += 1001;
    call('a');
    assert.equal(passes, 4);
});

test('auth limiter also blocks repeated attempts against one account from different IPs', () => {
    const limit = createLimit({limit:2});
    let passed=0,blocked=0;
    const res={set(){},status(code){assert.equal(code,429);blocked++;return this;},json(){}};
    for(const ip of ['a','b','c']) limit({ip,body:{email:' Test@Example.com '}},res,()=>passed++);
    assert.equal(passed,2);assert.equal(blocked,1);
});


test('JWT contains no profile PII and credential fingerprints use a separate key purpose',()=>{
    const old=process.env.JWT_SECRET;
    try {
        process.env.JWT_SECRET='jwt-only-test-key-at-least-32-bytes-long';
        const signed=signToken({userId:7,email:'private@example.invalid',phone:'0901234567'},'hash');
        const payload=verifyToken(signed);
        assert.equal(payload.userId,7);assert.equal(payload.email,undefined);assert.equal(payload.phone,undefined);
        assert.match(payload.cv,/^v1:/);
        assert.notEqual(payload.cv,'v1:'+require('node:crypto').createHmac('sha256',process.env.JWT_SECRET).update('hash').digest('hex'));
    } finally {if(old===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=old;}
});
