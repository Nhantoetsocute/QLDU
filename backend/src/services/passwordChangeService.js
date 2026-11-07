const bcrypt = require('bcryptjs');
const { transaction } = require('./orderSecurityService');
const { assertPasswordAllowed, PasswordPolicyError } = require('../security/passwordPolicy');
const { validPassword, passwordHashRounds } = require('../config/auth');

function createPasswordChangeService({
    pool,
    comparePassword = bcrypt.compare,
    hashPassword = (value) => bcrypt.hash(value, passwordHashRounds()),
    checkPassword = assertPasswordAllowed,
} = {}) {
    if (!pool) throw new Error('Password change service requires a database pool.');
    async function change(userId, currentPassword, newPassword) {
        if (!validPassword(newPassword)) {
            throw new PasswordPolicyError('WEAK_PASSWORD', 'Mật khẩu này quá phổ biến hoặc chưa đạt yêu cầu. Vui lòng chọn mật khẩu khác.');
        }
        await checkPassword(newPassword);
        return transaction(pool, async connection => {
            const [rows] = await connection.execute(
                'SELECT UserId, IsActive, PasswordHash FROM Users WHERE UserId = ? LIMIT 1 FOR UPDATE',
                [userId],
            );
            const user = rows[0];
            if (!user || Number(user.IsActive) !== 1 || !await comparePassword(currentPassword, user.PasswordHash)) return false;
            const passwordHash = await hashPassword(newPassword);
            const [updated] = await connection.execute(
                `UPDATE Users SET PasswordHash = ?, FailedLoginAttempts = 0, FirstFailedLoginAt = NULL,
                    LastFailedLoginAt = NULL, LockedUntil = NULL, LoginLockDurationSeconds = 0
                 WHERE UserId = ? AND IsActive = 1`,
                [passwordHash, userId],
            );
            return updated.affectedRows === 1;
        });
    }
    return { change };
}

module.exports = { createPasswordChangeService };
