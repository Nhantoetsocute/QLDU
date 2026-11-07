const { publicAsset } = require('../security/output');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const { sealField, revealRow, userLookups } = require('../security/dataFields');
const { transaction } = require('../services/orderSecurityService');
const { createOtpService } = require('../services/otpService');
const { createLoginService } = require('../services/loginService');
const { createPasswordChangeService } = require('../services/passwordChangeService');
const { assertPasswordAllowed } = require('../security/passwordPolicy');
const { signToken, validPassword, passwordHashRounds } = require('../config/auth');
const pool = require('../config/db');
const dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString('hex'), passwordHashRounds());
const otpService = createOtpService({pool});
const loginService = createLoginService({pool, dummyHash:dummyPasswordHash});
const passwordChangeService = createPasswordChangeService({pool});



// 1. Đăng ký (Register)
exports.register = async (req, res) => {
    const { userName, email, password, phone } = req.body;
    
    // Validate input đầy đủ
    if (typeof userName !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !userName.trim() || !email || !password) {
        return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Email không hợp lệ" });
    }

    // Validate password strength
    if (!validPassword(password)) {
        return res.status(400).json({ error: "Mật khẩu cần ít nhất 12 ký tự và tối đa 72 byte" });
    }

    try {
        await assertPasswordAllowed(password);
        const hashedPassword = await bcrypt.hash(password, passwordHashRounds());
        const lookups = userLookups({Email:email,Phone:phone || null});
        const userId = await transaction(pool,async connection => {
            const [result] = await connection.execute("INSERT INTO Users (UserCode,UserName,Email,PasswordHash,Phone) VALUES (?, '', '', ?, NULL)",['TMP'+randomBytes(8).toString('hex'),hashedPassword]);
            const id=result.insertId;
            await connection.execute("UPDATE Users SET UserCode = CONCAT('USR', LPAD(?,8,'0')), UserName = ?, Email = ?, Phone = ?, EmailLookup = ?, PhoneLookup = ? WHERE UserId = ?",[
                id,sealField('Users',id,'UserName',userName.trim()),sealField('Users',id,'Email',email.trim().toLowerCase()),
                sealField('Users',id,'Phone',phone || null),lookups.EmailLookup,lookups.PhoneLookup,id,
            ]);
            return id;
        });

        // Trả token ngay sau đăng ký (auto-login)
        const token = signToken(
            { userId, email: email.trim().toLowerCase() }, hashedPassword
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
        console.error('Register error:', error.code || 'REQUEST_FAILED');
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Email hoặc Phone đã tồn tại" });
        }
        if (error.code === 'WEAK_PASSWORD') return res.status(400).json({error:error.message,code:error.code});
        if (error.code === 'PASSWORD_CHECK_UNAVAILABLE') return res.status(503).json({error:error.message});
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// 2. Đăng nhập (Login)
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({ error: "Vui lòng nhập email và mật khẩu" });
    }

    try {
        const result = await loginService.authenticate(email,password);
        if (!result.ok) return res.status(401).json({
            error:'Thông tin đăng nhập không hợp lệ hoặc có thể đang bị giới hạn. Hãy thử lại sau hoặc khôi phục mật khẩu.',
            code:'INVALID_CREDENTIALS',
        });
        const user=result.user;
        const token = signToken({userId:user.UserId},user.PasswordHash);

        // Build full avatar URL
        let avatarFullUrl = null;
        if (user.AvatarUrl) {
            avatarFullUrl = publicAsset(req, user.AvatarUrl);
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
        console.error('Login error:', error.code || 'REQUEST_FAILED');
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

exports.changePassword = async (req,res,next) => {
    try {
        if (!validPassword(req.body.newPassword)) {
            const error=new Error('Mật khẩu này quá phổ biến hoặc chưa đạt yêu cầu. Vui lòng chọn mật khẩu khác.');
            error.status=400;error.code='WEAK_PASSWORD';throw error;
        }
        const changed=await passwordChangeService.change(req.user.userId,req.body.currentPassword,req.body.newPassword);
        if (!changed) return res.status(401).json({error:'Mật khẩu hiện tại không chính xác hoặc tài khoản không còn hoạt động.'});
        res.json({message:'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',reauthenticate:true});
    } catch(error) {
        if(error.code==='WEAK_PASSWORD' || error.code==='PASSWORD_CHECK_UNAVAILABLE') return next(error);
        console.error('ChangePassword error:',error.code || 'REQUEST_FAILED');
        return res.status(500).json({error:'Lỗi máy chủ.'});
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
        res.json(revealRow('Users',users[0]));
    } catch (error) {
        console.error('GetProfile error:', error.code || 'REQUEST_FAILED');
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

const emailService = require('../services/emailService');
const recoveryMessage = {message:'Nếu tài khoản hợp lệ, mã OTP sẽ được gửi đến email của bạn.'};
exports.forgotPassword = async (req,res,next) => {
    try {
        const challenge = await otpService.issue(req.body.email);
        if (challenge) {
            const sent = await emailService.sendOTP(req.body.email,challenge.otpCode);
            if (!sent) await otpService.revokeIssued(challenge);
        }
        res.json(recoveryMessage);
    } catch(error) { next(error); }
};
exports.verifyOTP = async (req,res,next) => {
    try {
        if (!await otpService.verify(req.body.email,req.body.otp)) return res.status(400).json({error:'Mã OTP không hợp lệ hoặc đã hết hạn.'});
        res.json({message:'Xác thực OTP thành công',validated:true});
    } catch(error) { next(error); }
};
exports.resetPassword = async (req,res,next) => {
    try {
        if (!await otpService.reset(req.body.email,req.body.otp,req.body.newPassword)) return res.status(400).json({error:'Phiên khôi phục không hợp lệ hoặc đã hết hạn.'});
        res.json({message:'Đặt lại mật khẩu thành công!'});
    } catch(error) { next(error); }
};
