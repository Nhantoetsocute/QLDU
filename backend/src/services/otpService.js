const { randomInt } = require('node:crypto');
const bcrypt = require('bcryptjs');
const cryptoVault = require('../security/cryptoVault');
const { transaction } = require('./orderSecurityService');
const { passwordHashRounds, validPassword } = require('../config/auth');
const { assertPasswordAllowed, PasswordPolicyError } = require('../security/passwordPolicy');
const MAX_ATTEMPTS = 5;

function createOtpService({ pool, vault = cryptoVault, now = Date.now, randomCode = () => randomInt(100000,1000000).toString(), hashPassword = (value) => bcrypt.hash(value,passwordHashRounds()), checkPassword = assertPasswordAllowed } = {}) {
    if (!pool) throw new Error('OTP service requires a database pool.');
    const lookup = email => vault.blindIndex(email.trim().toLowerCase(),'Users.Email');
    async function issue(email) {
        return transaction(pool,async connection => {
            const [users] = await connection.execute('SELECT UserId, IsActive FROM Users WHERE EmailLookup = ? LIMIT 1 FOR UPDATE',[lookup(email)]);
            const user = users[0];
            if (!user || Number(user.IsActive)!==1) return null;
            const otpCode = randomCode();
            if (!/^\d{6}$/.test(otpCode)) throw new Error('Invalid OTP generator.');
            // DATETIME stores whole seconds. Bind the verifier to exactly that persisted expiry.
            const expiry = new Date(Math.floor((now()+10*60*1000)/1000)*1000);
            const digest = vault.otpDigest(user.UserId,expiry,otpCode);
            await connection.execute('UPDATE Users SET OTPCode = NULL, OTPHash = ?, OTPExpiry = ?, OTPAttempts = 0 WHERE UserId = ? AND IsActive = 1',[digest,expiry,user.UserId]);
            return {userId:user.UserId,otpCode,digest};
        });
    }
    async function revokeIssued(challenge) {
        await pool.execute('UPDATE Users SET OTPHash = NULL, OTPExpiry = NULL, OTPAttempts = 0 WHERE UserId = ? AND OTPHash = ?',[challenge.userId,challenge.digest]);
    }
    async function check(email,otp,newPassword) {
        if (typeof otp!=='string' || !/^\d{6}$/.test(otp)) return false;
        if (newPassword!==undefined) {
            if (!validPassword(newPassword)) throw new PasswordPolicyError('WEAK_PASSWORD','Mật khẩu này quá phổ biến hoặc chưa đạt yêu cầu. Vui lòng chọn mật khẩu khác.');
            await checkPassword(newPassword);
        }
        return transaction(pool,async connection => {
            const [users]=await connection.execute('SELECT UserId, IsActive, OTPHash, OTPExpiry, OTPAttempts FROM Users WHERE EmailLookup = ? LIMIT 1 FOR UPDATE',[lookup(email)]);
            const user=users[0];
            if (!user || Number(user.IsActive)!==1 || !user.OTPHash || Number(user.OTPAttempts)>=MAX_ATTEMPTS) return false;
            const valid = new Date(user.OTPExpiry).getTime()>now() && vault.verifyOtpDigest(user.UserId,user.OTPExpiry,otp,user.OTPHash);
            if (!valid) {
                const attempts = Math.min(MAX_ATTEMPTS,Number(user.OTPAttempts || 0)+1);
                await connection.execute('UPDATE Users SET OTPAttempts = ?, OTPHash = CASE WHEN ? >= 5 THEN NULL ELSE OTPHash END, OTPExpiry = CASE WHEN ? >= 5 THEN NULL ELSE OTPExpiry END WHERE UserId = ?',[attempts,attempts,attempts,user.UserId]);
                // Return instead of throwing so failed attempts are committed and survive restarts.
                return false;
            }
            if (newPassword!==undefined) {
                const passwordHash=await hashPassword(newPassword);
                await connection.execute(`UPDATE Users SET PasswordHash = ?, OTPCode = NULL, OTPHash = NULL, OTPExpiry = NULL, OTPAttempts = 0,
                    FailedLoginAttempts = 0, FirstFailedLoginAt = NULL, LastFailedLoginAt = NULL, LockedUntil = NULL, LoginLockDurationSeconds = 0
                    WHERE UserId = ? AND IsActive = 1`,[passwordHash,user.UserId]);
            }
            return true;
        });
    }
    return {issue,revokeIssued,verify:(email,otp)=>check(email,otp),reset:(email,otp,password)=>check(email,otp,password)};
}
module.exports={createOtpService,MAX_ATTEMPTS};
