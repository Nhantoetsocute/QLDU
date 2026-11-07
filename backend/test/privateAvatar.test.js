const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const express = require('express');
const { createAvatarController } = require('../src/controllers/avatarController');
const { createAuthMiddleware } = require('../src/middleware/authMiddleware');
const { signToken } = require('../src/config/auth');
const vault=require('../src/security/cryptoVault').createVault({version:1,activeKeyId:'avatar-test',encryptionKeys:{'avatar-test':Buffer.alloc(32,1).toString('base64')},otpKey:Buffer.alloc(32,2).toString('base64'),indexKey:Buffer.alloc(32,3).toString('base64')});
const encrypted=(name,text)=>vault.sealBytes(Buffer.from(text),'avatar:'+name);
process.env.JWT_SECRET = 'private-avatar-test-only-secret-at-least-32-bytes';

async function start(t, storedPath) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qldu-private-avatar-'));
    const outside = path.join(directory, 'outside.txt');
    await fs.writeFile(outside, 'outside-private-data');
    const avatars = path.join(directory, 'avatars');
    await fs.mkdir(avatars);
    await fs.writeFile(path.join(avatars, 'avatar_7_1776817599630.png'), encrypted('avatar_7_1776817599630.png','own-png-bytes'));
    await fs.writeFile(path.join(avatars, 'avatar_7_1779458160103.jpg'), encrypted('avatar_7_1779458160103.jpg','own-jpg-bytes'));
    await fs.writeFile(path.join(avatars, 'avatar_7_random_name.webp'), encrypted('avatar_7_random_name.webp','own-webp-bytes'));
    await fs.writeFile(path.join(avatars, 'avatar_9_other.webp'), encrypted('avatar_9_other.webp','other-users-private-image'));
    await fs.symlink(outside, path.join(avatars, 'avatar_7_symlink.webp'));
    await fs.mkdir(path.join(avatars, 'avatar_7_directory.webp'));
    const reads = [];
    const app = express();
    app.get('/api/user/avatar', createAuthMiddleware({ getUser: async (userId) => ({ UserId: userId, IsActive: 1, PasswordHash: 'avatar-test-hash' }) }),
        createAvatarController({ decrypt:vault.openBytes,avatarDirectory: avatars, readAvatar: async (userId) => { reads.push(userId); return storedPath; } }));
    app.use(require('../src/middleware/securityErrors'));
    const server = http.createServer(app);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true }); });
    return {
        url: `http://127.0.0.1:${server.address().port}/api/user/avatar`, reads,
        authorization: { Authorization: `Bearer ${signToken({ userId: 7 }, 'avatar-test-hash')}` },
    };
}

test('private avatar route requires login before looking up a profile image', async (t) => {
    const { url, reads } = await start(t, '/avatars/avatar_7_random_name.webp');
    const response = await fetch(url);
    assert.equal(response.status, 401);
    assert.equal(reads.length, 0);
});

for (const [filename, type, content] of [
    ['avatar_7_1776817599630.png', 'image/png', 'own-png-bytes'],
    ['avatar_7_1779458160103.jpg', 'image/jpeg', 'own-jpg-bytes'],
    ['avatar_7_random_name.webp', 'image/webp', 'own-webp-bytes'],
]) test(`private avatar serves own ${type} without a public cache`, async (t) => {
    const { url, reads, authorization } = await start(t, `/avatars/${filename}`);
    const response = await fetch(url, { headers: authorization });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), type);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await response.text(), content);
    assert.deepEqual(reads, [7]);
});

for (const storedPath of [
    '/avatars/avatar_9_other.webp',
    '/avatars/../outside.txt',
    '/avatars/avatar_7_../../outside.txt',
    '/avatars/avatar_7_symlink.webp',
    '/avatars/avatar_7_directory.webp',
    '/avatars/avatar_7_missing.webp',
    '/avatars/avatar_7_script.svg',
    'https://external.example/avatar_7_random_name.webp',
]) test(`private avatar rejects unsafe or foreign stored path ${storedPath}`, async (t) => {
    const { url, authorization } = await start(t, storedPath);
    const response = await fetch(url, { headers: authorization });
    assert.equal(response.status, 404);
    const body = await response.text();
    assert.ok(!body.includes('outside-private-data'));
    assert.ok(!body.includes('other-users-private-image'));
    assert.ok(!body.includes(storedPath));
});

test('query parameters cannot select another account avatar', async (t) => {
    const { url, reads, authorization } = await start(t, '/avatars/avatar_7_random_name.webp');
    const response = await fetch(`${url}?userId=9&filename=avatar_9_other.webp`, { headers: authorization });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'own-webp-bytes');
    assert.deepEqual(reads, [7]);
});
