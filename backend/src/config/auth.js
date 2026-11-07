const jwt = require('jsonwebtoken');
const { createHmac, hkdfSync } = require('node:crypto');
const { isCommonPassword } = require('../security/passwordPolicy');

function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32 || /^(secret|super_secret|change|replace)/i.test(secret)) {
        throw new Error('JWT_SECRET phải là khóa ngẫu nhiên riêng, tối thiểu 32 byte.');
    }
    return secret;
}
const options = { algorithm: 'HS256', issuer: 'qldu-api', audience: 'qldu-app', expiresIn: '1d' };
exports.getSecret = getSecret;
const credentialVersion = (hash) => {
    const key = Buffer.from(hkdfSync('sha256', Buffer.from(getSecret()), Buffer.alloc(0), 'qldu:credential-fingerprint:v1', 32));
    return 'v1:' + createHmac('sha256', key).update(hash).digest('hex');
};
exports.credentialVersion = credentialVersion;
exports.signToken = (payload, passwordHash) => jwt.sign({ userId:payload.userId, ...(passwordHash ? { cv: credentialVersion(passwordHash) } : {}) }, getSecret(), options);
exports.verifyToken = (token) => jwt.verify(token, getSecret(), {
    algorithms: ['HS256'], issuer: options.issuer, audience: options.audience,
});
exports.validPassword = (value) => typeof value === 'string' && value.length >= 12
    && Buffer.byteLength(value) <= 72 && !isCommonPassword(value);
exports.passwordHashRounds = () => {
    const value = process.env.BCRYPT_ROUNDS || '12';
    if (!/^(10|11|12|13|14)$/.test(value)) throw new Error('BCRYPT_ROUNDS phải từ 10 đến 14.');
    return Number(value);
};
