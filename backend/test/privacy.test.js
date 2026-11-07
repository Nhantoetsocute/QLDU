require('./setup-crypto');
const { sealField, openField } = require('../src/security/dataFields');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createPrivacyService, cleanupAvatarFiles, MAX_EXPORT_ROWS, MAX_EXPORT_BYTES, PrivacyError } = require('../src/services/privacyService');
const { createPrivacyController } = require('../src/controllers/privacyController');

function fixture(overrides = {}) {
    const events = [];
    const queries = [];
    const connection = {
        beginTransaction: async () => events.push('begin'),
        commit: async () => events.push('commit'),
        rollback: async () => events.push('rollback'),
        release: () => events.push('release'),
        async execute(sql, args) {
            queries.push({ sql, args });
            events.push(sql.startsWith('UPDATE') || sql.startsWith('DELETE') ? 'mutation' : 'query');
            if (overrides.execute) return overrides.execute(sql, args);
            if (sql.startsWith('SELECT UserId, IsActive')) return [[{ UserId: 7, IsActive: 1, PasswordHash: 'old-hash' }]];
            if (sql.startsWith('SELECT UserId, UserCode')) return [[{ UserId: 7, UserCode: 'USR00000007', UserName: sealField('Users',7,'UserName','User'), Email: sealField('Users',7,'Email','user@example.test'), PasswordHash: 'must-not-export', OTPCode: '123456' }]];
            if (sql === 'SELECT OrderId FROM Orders WHERE UserId = ? FOR UPDATE') return [[{OrderId:12}]];
            if (sql.startsWith('SELECT')) return [[]];
            return [{ affectedRows: 1 }];
        },
    };
    const pool = { getConnection: async () => connection };
    const service = createPrivacyService({
        pool,
        comparePassword: async () => overrides.passwordMatches ?? true,
        hashPassword: async () => 'new-random-hash',
        random: size => Buffer.alloc(size, 1),
        cleanupAvatars: async userId => { events.push('cleanup'); assert.equal(userId, 7); return { incomplete: false }; },
        now: () => new Date('2026-11-07T00:00:00Z'),
        ...overrides.service,
    });
    return { service, queries, events };
}

test('privacy export includes only own fields and excludes password hashes, OTP and credential metadata', async () => {
    const f = fixture();
    const result = await f.service.exportData(7);
    assert.equal(result.profile.UserId, 7);
    assert.equal(result.profile.Email, 'user@example.test');
    assert.ok(!JSON.stringify(result).includes('must-not-export'));
    assert.ok(!JSON.stringify(result).includes('OTPCode'));
    assert.ok(!JSON.stringify(result).includes('PasswordHash'));
    assert.equal(result.exportedAt, '2026-11-07T00:00:00.000Z');
    for (const { sql, args } of f.queries) {
        assert.deepEqual(args, [7]);
        assert.match(sql, /(?:\b|\.)UserId = \?/);
        assert.ok(!sql.includes('SELECT *'));
    }
    assert.deepEqual(f.events.slice(-2), ['commit', 'release']);
});

test('privacy export rejects excess rows explicitly and rolls back rather than silently truncating', async () => {
    const f = fixture({ execute(sql) {
        if (sql.startsWith('SELECT UserId, UserCode')) return [[{ UserId: 7 }]];
        return [Array.from({ length: MAX_EXPORT_ROWS + 1 }, () => ({ AddressId: 1 }))];
    } });
    await assert.rejects(f.service.exportData(7), { status: 413, code: 'EXPORT_TOO_LARGE' });
    assert.deepEqual(f.events.slice(-2), ['rollback', 'release']);
});

test('privacy export rejects oversized bytes explicitly and inactive users cannot export', async () => {
    const huge = fixture({ execute(sql) {
        if (sql.startsWith('SELECT UserId, UserCode')) return [[{ UserId: 7 }]];
        return [[{ AddressId:1,AddressLine:sealField('DeliveryAddresses',1,'AddressLine','x'.repeat(MAX_EXPORT_BYTES)) }]];
    } });
    await assert.rejects(huge.service.exportData(7), { status: 413 });
    const missing = fixture({ execute: async () => [[]] });
    await assert.rejects(missing.service.exportData(7), { status: 401 });
});

test('wrong password cannot close an account or remove avatars', async () => {
    const f = fixture({ passwordMatches: false });
    await assert.rejects(f.service.closeAccount(7, 'wrong-password'), { status: 401, code: 'REAUTHENTICATION_FAILED' });
    assert.equal(f.queries.length, 1);
    assert.match(f.queries[0].sql, /UserId = \? FOR UPDATE/);
    assert.ok(!f.events.includes('mutation'));
    assert.ok(!f.events.includes('cleanup'));
    assert.deepEqual(f.events.slice(-2), ['rollback', 'release']);
});

test('closure requires current credentials even if session was authenticated before account lock', async () => {
    const f = fixture({ execute: async () => [[{ UserId: 7, IsActive: 0, PasswordHash: 'old-hash' }]] });
    await assert.rejects(f.service.closeAccount(7, 'password'), { status: 401 });
    assert.ok(!f.events.includes('mutation'));
});

test('active orders or unsettled payments block closure without mutation', async () => {
    for (const reason of ['active', 'payment']) {
        const f = fixture({ execute(sql) {
            if (sql.startsWith('SELECT UserId, IsActive')) return [[{ UserId: 7, IsActive: 1, PasswordHash: 'hash' }]];
            if (reason === 'active' && sql.includes('StatusId IN (1, 2)')) return [[{ OrderId: 12 }]];
            if (reason === 'payment' && sql.includes('FROM PaymentTransactions')) return [[{ OrderId: 12 }]];
            return [[]];
        } });
        await assert.rejects(f.service.closeAccount(7, 'password'), { status: 409 });
        assert.ok(!f.events.includes('mutation'));
        assert.ok(!f.events.includes('cleanup'));
    }
});

test('closure anonymizes only the authenticated account, retains accounting rows and cleans files after commit', async () => {
    const f = fixture();
    const result = await f.service.closeAccount(7, 'password');
    assert.equal(result.closed, true);
    assert.equal(result.avatarCleanupPending, false);
    const mutations = f.queries.filter(q => /^(UPDATE|DELETE)/.test(q.sql));
    assert.equal(mutations.length, 6);
    for (const { sql, args } of mutations) {
        assert.match(sql, /(?:\b|\.)UserId = \?/);
        assert.equal(args.at(-1), 7);
        assert.ok(!/^DELETE FROM Users/.test(sql));
        assert.ok(!/^DELETE FROM Orders/.test(sql));
    }
    const userUpdate = mutations.find(q => q.sql.startsWith('UPDATE Users'));
    assert.match(userUpdate.sql, /IsActive = 0/);
    assert.match(userUpdate.sql, /OTPCode = NULL/);
    assert.match(userUpdate.sql, /AvatarUrl = NULL/);
    assert.match(openField('Users',7,'Email',userUpdate.args[1]), /^closed-[a-f0-9]{32}@users\.invalid$/);
    assert.equal(userUpdate.args[3], 'new-random-hash');
    assert.ok(!JSON.stringify(userUpdate.args).includes('Tài khoản đã đóng'));
    const orderUpdate=mutations.find(q=>q.sql.startsWith('UPDATE Orders'));
    assert.equal(openField('Orders',12,'ReceiverName',orderUpdate.args[0]),'Tài khoản đã đóng');
    assert.ok(f.events.indexOf('cleanup') > f.events.indexOf('commit'));
    assert.ok(f.events.indexOf('cleanup') > f.events.indexOf('release'));
});

test('database failure rolls back account closure and prevents file cleanup', async () => {
    const f = fixture({ execute(sql) {
        if (sql.startsWith('SELECT UserId, IsActive')) return [[{ UserId: 7, IsActive: 1, PasswordHash: 'hash' }]];
        if (sql.startsWith('SELECT')) return [[]];
        throw new Error('database failed');
    } });
    await assert.rejects(f.service.closeAccount(7, 'password'));
    assert.ok(!f.events.includes('cleanup'));
    assert.deepEqual(f.events.slice(-2), ['rollback', 'release']);
});

test('completed closure reports pending avatar cleanup without pretending a committed DB change rolled back', async () => {
    const f = fixture({ service: { cleanupAvatars: async () => ({ incomplete: true }) } });
    assert.equal((await f.service.closeAccount(7, 'password')).avatarCleanupPending, true);
    assert.ok(f.events.includes('commit'));
});

test('avatar cleanup removes only regular files anchored to owner; no traversal, sibling user or symlink target deletion', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qldu-privacy-test-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    for (const file of ['avatar_7_123.png', 'avatar_7_abc123.webp', 'avatar_8_123.jpg', 'avatar_77_123.jpg', 'unrelated.jpg']) await fs.writeFile(path.join(directory, file), 'test');
    await fs.mkdir(path.join(directory, 'avatar_7_directory.png'));
    await fs.symlink(path.join(directory, 'unrelated.jpg'), path.join(directory, 'avatar_7_link.jpg'));
    assert.equal((await cleanupAvatarFiles(7, directory)).incomplete, false);
    const remaining = await fs.readdir(directory);
    assert.ok(!remaining.includes('avatar_7_123.png'));
    assert.ok(!remaining.includes('avatar_7_abc123.webp'));
    for (const file of ['avatar_8_123.jpg', 'avatar_77_123.jpg', 'unrelated.jpg', 'avatar_7_directory.png', 'avatar_7_link.jpg']) assert.ok(remaining.includes(file));
    await assert.rejects(cleanupAvatarFiles('../7', directory));
});

function response() {
    return { headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
test('privacy controller export sets a fixed attachment filename and no-store', async () => {
    const controller = createPrivacyController({ service: { exportData: async userId => ({ userId }) } });
    const res = response();
    await controller.exportData({ user: { userId: 7 } }, res, error => { throw error; });
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.headers['Content-Disposition'], 'attachment; filename="true-juice-personal-data.json"');
    assert.deepEqual(res.body, { userId: 7 });
});

test('privacy controller rejects extra properties and non-string passwords before calling service', async () => {
    let calls = 0;
    const controller = createPrivacyController({ service: { closeAccount: async () => { calls++; } } });
    for (const body of [null, [], {}, { password: 'password', userId: 8 }, { password: { value: 'password' } }, { password: 'x'.repeat(257) }]) {
        const res = response();
        await controller.closeAccount({ user: { userId: 7 }, body }, res, error => { throw error; });
        assert.equal(res.code, 400);
    }
    assert.equal(calls, 0);
});

test('privacy controller returns deliberate reauthentication errors and forwards unexpected errors', async () => {
    const deliberate = createPrivacyController({ service: { closeAccount: async () => { throw new PrivacyError(401, 'REAUTHENTICATION_FAILED', 'Mật khẩu không chính xác.'); } } });
    const res = response();
    await deliberate.closeAccount({ user: { userId: 7 }, body: { password: 'password' } }, res, error => { throw error; });
    assert.equal(res.code, 401);
    assert.equal(res.body.code, 'REAUTHENTICATION_FAILED');
    const unexpected = new Error('private database text');
    let received;
    const controller = createPrivacyController({ service: { exportData: async () => { throw unexpected; } } });
    await controller.exportData({ user: { userId: 7 } }, response(), error => { received = error; });
    assert.equal(received, unexpected);
});
