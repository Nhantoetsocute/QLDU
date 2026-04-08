const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const SECRET_KEY = process.env.JWT_SECRET || 'secret';

// 1. Đăng ký (Register)
exports.register = async (req, res) => {
    const { userName, email, password, phone } = req.body;
    
    // Validate input đầy đủ
    if (!userName || !email || !password) {
        return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Email không hợp lệ" });
    }

    // Validate password strength
    if (password.length < 6) {
        return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    try {
        // Kiểm tra email tồn tại trước (tránh hash password thừa)
        const [existing] = await pool.execute("SELECT UserId FROM Users WHERE Email = ? LIMIT 1", [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "Email đã được sử dụng" });
        }

        const hashedPassword = await bcrypt.hash(password, 10); 
        
        const insertSql = `
            INSERT INTO Users (UserCode, UserName, Email, PasswordHash, Phone) 
            VALUES ('TEMP', ?, ?, ?, ?)
        `;
        const [result] = await pool.execute(insertSql, [userName.trim(), email.trim().toLowerCase(), hashedPassword, phone || null]);
        
        const userId = result.insertId;
        
        const updateSql = `UPDATE Users SET UserCode = CONCAT('USR', LPAD(?, 8, '0')) WHERE UserId = ?`;
        await pool.execute(updateSql, [userId, userId]);

        // Trả token ngay sau đăng ký (auto-login)
        const token = jwt.sign(
            { userId, email: email.trim().toLowerCase() },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        res.status(201).json({ 
            message: "Đăng ký thành công!", 
            userId,
            token,
            user: {
                id: userId,
                name: userName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone || null,
            }
        });
    } catch (error) {
        console.error('Register error:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Email hoặc Phone đã tồn tại" });
        }
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// 2. Đăng nhập (Login)
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Vui lòng nhập email và mật khẩu" });
    }

    try {
        // Chỉ SELECT những column cần thiết (tối ưu I/O)
        const [users] = await pool.execute(
            "SELECT UserId, UserCode, UserName, Email, PasswordHash, Phone, AvatarUrl, IsActive FROM Users WHERE Email = ? LIMIT 1", 
            [email.trim().toLowerCase()]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: "Tài khoản không tồn tại" });
        }

        const user = users[0];

        if (user.IsActive === 0) {
            return res.status(403).json({ error: "Tài khoản đang bị khóa" });
        }

        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        
        if (!isMatch) {
            return res.status(400).json({ error: "Sai mật khẩu" });
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
        console.error('Login error:', error.message);
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
        if (users.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy người dùng" });
        }
        res.json(users[0]);
    } catch (error) {
        console.error('GetProfile error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
