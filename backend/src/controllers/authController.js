const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const SECRET_KEY = process.env.JWT_SECRET || 'secret';

// 1. Đăng ký (Register)
exports.register = async (req, res) => {
    const { userName, email, password, phone } = req.body;
    if (!userName || !email || !password) {
        return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); 
        
        const insertSql = `
            INSERT INTO Users (UserCode, UserName, Email, PasswordHash, Phone) 
            VALUES ('TEMP', ?, ?, ?, ?)
        `;
        const [result] = await pool.execute(insertSql, [userName, email, hashedPassword, phone]);
        
        const userId = result.insertId;
        
        const updateSql = `UPDATE Users SET UserCode = CONCAT('USR', LPAD(?, 8, '0')) WHERE UserId = ?`;
        await pool.execute(updateSql, [userId, userId]);

        res.status(201).json({ message: "Đăng ký thành công!", userId });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Email hoặc Phone đã tồn tại" });
        }
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// 2. Đăng nhập (Login)
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await pool.execute("SELECT * FROM Users WHERE Email = ? LIMIT 1", [email]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: "Tài khoản không tồn tại" });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        
        if (!isMatch) {
            return res.status(400).json({ error: "Sai mật khẩu" });
        }

        if (user.IsActive === 0) {
            return res.status(403).json({ error: "Tài khoản đang bị khóa" });
        }

        const token = jwt.sign(
            { userId: user.UserId, email: user.Email, userCode: user.UserCode }, 
            SECRET_KEY, 
            { expiresIn: '30d' }
        );

        res.json({ 
            message: "Đăng nhập thành công", 
            token,
            user: {
                id: user.UserId,
                code: user.UserCode,
                name: user.UserName,
                email: user.Email,
                phone: user.Phone,
                avatar: user.AvatarUrl
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// 3. Lấy thông tin User hiện tại
exports.getProfile = async (req, res) => {
    try {
        const [users] = await pool.execute(
            "SELECT UserId, UserCode, UserName, Email, Phone, AvatarUrl, IsActive FROM Users WHERE UserId = ?", 
            [req.user.userId]
        );
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
