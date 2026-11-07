const bcrypt = require('bcryptjs');
const { transaction } = require('./orderSecurityService');
const { createDataFields } = require('../security/dataFields');
const cryptoVault = require('../security/cryptoVault');
const { passwordHashRounds } = require('../config/auth');

const FAILURE_LIMIT = 4;
const FAILURE_WINDOW_MS = 30 * 1000;
const LOCK_STEP_SECONDS = 30;

function asDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (Number.isFinite(parsed.getTime())) return parsed;
    }
    return null;
}

function createLoginService({
    pool,
    vault = cryptoVault,
    comparePassword = bcrypt.compare,
    hashPassword = (value) => bcrypt.hash(value, passwordHashRounds()),
    needsRehash = (hash) => bcrypt.getRounds(hash) < passwordHashRounds(),
    now = Date.now,
    dummyHash,
} = {}) {
    if (!pool) throw new Error('Login service requires a database pool.');
    const dataFields=createDataFields(vault);
    const unknownAccountHash=dummyHash || bcrypt.hashSync(require('node:crypto').randomBytes(32).toString('hex'),passwordHashRounds());
    async function authenticate(email, password) {
        const emailLookup = vault.blindIndex(email.trim().toLowerCase(), 'Users.Email');
        return transaction(pool, async connection => {
            const [rows] = await connection.execute(
                `SELECT UserId, UserCode, UserName, Email, PasswordHash, Phone, AvatarUrl, IsActive,
                    FailedLoginAttempts, FirstFailedLoginAt, LastFailedLoginAt, LockedUntil, LoginLockDurationSeconds
                 FROM Users WHERE EmailLookup = ? LIMIT 1 FOR UPDATE`,
                [emailLookup],
            );
            const user = rows[0];
            if (!user || Number(user.IsActive) !== 1) {
                await comparePassword(password, unknownAccountHash);
                return { ok: false };
            }

            const [clockRows]=await connection.execute('SELECT NOW(3) AS LoginNow');
            const currentTime = asDate(clockRows[0]?.LoginNow)?.getTime() ?? now();
            const lockedUntil = asDate(user.LockedUntil)?.getTime();
            if (lockedUntil !== undefined && lockedUntil !== null && lockedUntil > currentTime) {
                await comparePassword(password, unknownAccountHash);
                return { ok: false };
            }

            const matches = await comparePassword(password, user.PasswordHash);
            if (!matches) {
                const lastFailedAt = asDate(user.LastFailedLoginAt)?.getTime();
                const expiredWindow = lastFailedAt !== undefined && lastFailedAt !== null
                    && currentTime - lastFailedAt >= FAILURE_WINDOW_MS;
                const attempts = expiredWindow ? 1 : Number(user.FailedLoginAttempts || 0) + 1;
                const hasExpiredLock = lockedUntil !== undefined && lockedUntil !== null && lockedUntil <= currentTime;
                let lockDuration = Number(user.LoginLockDurationSeconds || 0);
                const shouldLock = hasExpiredLock || attempts >= FAILURE_LIMIT;
                if (shouldLock) {
                    lockDuration = hasExpiredLock
                        ? Math.max(LOCK_STEP_SECONDS, lockDuration + LOCK_STEP_SECONDS)
                        : Math.max(LOCK_STEP_SECONDS, lockDuration);
                }
                await connection.execute(
                    `UPDATE Users SET FailedLoginAttempts = ?, FirstFailedLoginAt = IF(?, NOW(3), FirstFailedLoginAt),
                        LastFailedLoginAt = NOW(3),
                        LockedUntil = IF(?, TIMESTAMPADD(SECOND, ?, NOW(3)), NULL),
                        LoginLockDurationSeconds = ? WHERE UserId = ? AND IsActive = 1`,
                    [attempts, expiredWindow || !user.FirstFailedLoginAt ? 1 : 0, shouldLock ? 1 : 0,
                        shouldLock ? lockDuration : 0, shouldLock ? lockDuration : user.LoginLockDurationSeconds, user.UserId],
                );
                return { ok: false, warningLevel: attempts, locked: shouldLock };
            }

            let passwordHash = user.PasswordHash;
            if (needsRehash(passwordHash)) passwordHash = await hashPassword(password);
            const [updated] = await connection.execute(
                `UPDATE Users SET PasswordHash = ?, FailedLoginAttempts = 0, FirstFailedLoginAt = NULL,
                    LastFailedLoginAt = NULL, LockedUntil = NULL, LoginLockDurationSeconds = 0
                 WHERE UserId = ? AND IsActive = 1`,
                [passwordHash, user.UserId],
            );
            if (updated.affectedRows !== 1) return { ok: false };
            const profile = dataFields.revealRow('Users', { ...user, PasswordHash: passwordHash });
            return { ok: true, user: profile };
        });
    }
    return { authenticate };
}

module.exports = { createLoginService, FAILURE_LIMIT, FAILURE_WINDOW_MS, LOCK_STEP_SECONDS };
