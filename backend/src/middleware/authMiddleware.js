const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'secret';

const verifyToken = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) {
        return res.status(401).json({ error: "Yêu cầu đăng nhập." });
    }

    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    if (!token) {
        return res.status(401).json({ error: "Token không hợp lệ." });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
        }
        return res.status(401).json({ error: "Token không hợp lệ hoặc đã bị thay đổi." });
    }
};

module.exports = verifyToken;
