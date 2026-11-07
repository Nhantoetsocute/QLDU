// Test workers never read a developer/production key file or reuse persisted data keys.
const { randomBytes } = require('node:crypto');
process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({test:randomBytes(32).toString('base64')});
process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID = 'test';
process.env.OTP_HMAC_KEY = randomBytes(32).toString('base64');
process.env.DATA_INDEX_KEY = randomBytes(32).toString('base64');
process.env.BCRYPT_ROUNDS = '10';
