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

        // Build full avatar URL
        let avatarFullUrl = null;
        if (user.AvatarUrl) {
            const reqHost = req.headers['host'] || `localhost:${process.env.PORT || 3000}`;
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            avatarFullUrl = `${protocol}://${reqHost}${user.AvatarUrl}`;
        }

        res.json({ 
            message: "Đăng nhập thành công", 
            token,
            user: {
                id: user.UserId,
                code: user.UserCode,
                name: user.UserName,
                email: user.Email,
                phone: user.Phone,
                avatar: avatarFullUrl
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

const emailService = require('../services/emailService');

// 4. Quên mật khẩu - Tạo OTP và gửi email
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Vui lòng nhập email" });

    try {
        const emailLower = email.trim().toLowerCase();
        const [users] = await pool.execute("SELECT UserId, UserName FROM Users WHERE Email = ? LIMIT 1", [emailLower]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: "Email không tồn tại trong hệ thống" });
        }

        const user = users[0];
        
        // Tạo mã OTP 6 số
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Hết hạn sau 10 phút
        const expiryDate = new Date(Date.now() + 10 * 60000); 

        // Lưu OTP vào database
        await pool.execute(
            "UPDATE Users SET OTPCode = ?, OTPExpiry = ? WHERE UserId = ?",
            [otpCode, expiryDate, user.UserId]
        );

        // Gửi email
        const emailSent = await emailService.sendOTP(emailLower, otpCode);
        
        if (!emailSent) {
            return res.status(500).json({ error: "Lỗi máy chủ gửi email. Vui lòng thử lại sau." });
        }

        res.json({ message: "Mã OTP đã được gửi vào email của bạn." });
    } catch (error) {
        console.error('forgotPassword error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// 5. Xác thực OTP
exports.verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Thiếu thông tin xác thực" });

    try {
        const emailLower = email.trim().toLowerCase();
        const [users] = await pool.execute(
            "SELECT UserId, OTPCode, OTPExpiry FROM Users WHERE Email = ? LIMIT 1",
            [emailLower]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: "Tài khoản không tồn tại" });
        }

        const user = users[0];

        if (!user.OTPCode || user.OTPCode !== otp) {
            return res.status(400).json({ error: "Mã OTP không chính xác" });
        }

        if (new Date() > new Date(user.OTPExpiry)) {
            return res.status(400).json({ error: "Mã OTP đã hết hạn" });
        }

        // Token hợp lệ, frontend có thể chuyển sang bước đổi mật khẩu
        res.json({ message: "Xác thực OTP thành công", validated: true });
    } catch (error) {
        console.error('verifyOTP error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// 6. Đặt lại Mật Khẩu Mới
exports.resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: "Thiếu thông tin thiết lập mật khẩu" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    try {
        const emailLower = email.trim().toLowerCase();
        // Cùng kiểm tra lại vòng bảo vệ OTP tránh gọi API thẳng
        const [users] = await pool.execute(
            "SELECT UserId, OTPCode, OTPExpiry FROM Users WHERE Email = ? LIMIT 1",
            [emailLower]
        );

        if (users.length === 0) return res.status(404).json({ error: "Tài khoản không tồn tại" });
        const user = users[0];

        if (!user.OTPCode || user.OTPCode !== otp) {
            return res.status(400).json({ error: "Phiên khôi phục không hợp lệ hoặc đã hết hạn" });
        }

        // Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Cập nhật Database, xóa OTP
        await pool.execute(
            "UPDATE Users SET PasswordHash = ?, OTPCode = NULL, OTPExpiry = NULL WHERE UserId = ?",
            [hashedPassword, user.UserId]
        );

        res.json({ message: "Đặt lại mật khẩu thành công!" });
    } catch (error) {
        console.error('resetPassword error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

