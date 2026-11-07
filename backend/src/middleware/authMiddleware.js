const { verifyToken, credentialVersion } = require('../config/auth');
const { id } = require('../security/validation');
function createAuthMiddleware({ getUser = async (userId) => {
    const [rows] = await require('../config/db').execute('SELECT UserId, IsActive, PasswordHash FROM Users WHERE UserId = ? LIMIT 1', [userId]);
    return rows[0];
} } = {}) {
    return async (req, res, next) => {
        const header = req.headers.authorization;
        if (typeof header !== 'string' || !/^Bearer [^ ]{1,4096}$/.test(header)) return res.status(401).json({ error:'Yêu cầu đăng nhập.' });
        let decoded;
        try { decoded = verifyToken(header.slice(7)); id(decoded.userId); }
        catch { return res.status(401).json({error:'Phiên đăng nhập không hợp lệ hoặc hết hạn.'}); }
        try {
            const user = await getUser(decoded.userId);
            if (!user || Number(user.IsActive) !== 1 || typeof user.PasswordHash !== 'string'
                || decoded.cv !== credentialVersion(user.PasswordHash)) {
                return res.status(401).json({error:'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.'});
            }
            // Only the database identity is carried forward; request role/userId claims are never trusted.
            req.user = {userId:id(user.UserId)};
            res.set('Cache-Control','no-store');
            return next();
        } catch { return res.status(503).json({error:'Chưa thể xác thực tài khoản. Vui lòng thử lại sau.'}); }
    };
}
module.exports = createAuthMiddleware();
module.exports.createAuthMiddleware = createAuthMiddleware;
