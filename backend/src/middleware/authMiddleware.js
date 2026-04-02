const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'secret';

const verifyToken = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ error: "Yêu cầu đăng nhập." });
    
    const token = header.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token sai hoặc hết hạn." });
        req.user = decoded; 
        next(); 
    });
};

module.exports = verifyToken;
