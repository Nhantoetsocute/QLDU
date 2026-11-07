const { sealField, openField, userLookups } = require('../security/dataFields');
const { publicAsset } = require('../security/output');
const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

const avatarsDir = path.join(__dirname, '../../public/avatars');
async function removeUploadedAvatar(filename) {
    try {
        await fs.promises.unlink(path.join(avatarsDir, filename));
        return false;
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        console.error('Avatar cleanup failed:', error.code || 'CLEANUP_FAILED');
        return true;
    }
}

// Lấy thông tin cá nhân (Profile)
exports.getProfile = async (req, res) => {
    try {
        const [users] = await pool.execute(
            `SELECT 
                UserId, UserCode, 
                UserName as name, 
                Email as email, 
                Phone as phone, 
                Address as address, 
                AvatarUrl as avatar 
            FROM Users 
            WHERE UserId = ?`, 
            [req.user.userId]
        );
        if (users.length === 0) return res.status(404).json({ error: "Không tìm thấy user" });
        
        // Build full URL cho avatar
        const user = users[0];
        for (const [alias,column] of Object.entries({name:'UserName',email:'Email',phone:'Phone',address:'Address'})) user[alias]=openField('Users',req.user.userId,column,user[alias]);
        if (user.avatar) {
            user.avatar = publicAsset(req, user.avatar);
        }
        res.json(user);
    } catch (error) {
        console.error('GetProfile error:', error.code || 'REQUEST_FAILED');
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Cập nhật thông tin cá nhân
exports.updateProfile = async (req, res) => {
    const { name, phone, address } = req.body;
    
    // Validate: ít nhất 1 trường phải có
    if (name === undefined && phone === undefined && address === undefined) {
        return res.status(400).json({ error: "Cần ít nhất 1 trường để cập nhật" });
    }

    try {
        // Chỉ update các trường được gửi lên (không ghi null thừa)
        const fields = [];
        const values = [];
        
        if (name !== undefined) { fields.push('UserName = ?'); values.push(sealField('Users',req.user.userId,'UserName',name.trim())); }
        if (phone !== undefined) { fields.push('Phone = ?', 'PhoneLookup = ?'); values.push(sealField('Users',req.user.userId,'Phone',phone.trim() || null), userLookups({Phone:phone.trim() || null}).PhoneLookup); }
        if (address !== undefined) { fields.push('Address = ?'); values.push(sealField('Users',req.user.userId,'Address',address.trim() || null)); }
        
        values.push(req.user.userId);

        const [result] = await pool.execute(
            `UPDATE Users SET ${fields.join(', ')} WHERE UserId = ? AND IsActive = 1`,
            values
        );

        if (result.affectedRows !== 1) return res.status(401).json({error:'Tài khoản không còn hoạt động.'});

        // Trả về profile mới sau khi update (để FE đồng bộ ngay)
        const [updated] = await pool.execute(
            `SELECT UserName as name, Email as email, Phone as phone, Address as address, AvatarUrl as avatar 
             FROM Users WHERE UserId = ?`,
            [req.user.userId]
        );

        // Build full URL cho avatar
        const profile = updated[0];
        for (const [alias,column] of Object.entries({name:'UserName',email:'Email',phone:'Phone',address:'Address'})) profile[alias]=openField('Users',req.user.userId,column,profile[alias]);
        if (profile.avatar) {
            profile.avatar = publicAsset(req, profile.avatar);
        }

        res.json({ message: "Cập nhật thành công!", profile });
    } catch (error) {
        console.error('UpdateProfile error:', error.code || 'REQUEST_FAILED');
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Số điện thoại đã được sử dụng" });
        }
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Upload ảnh đại diện
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Không tìm thấy file ảnh' });
        }

        // Đường dẫn tương đối để lưu vào DB
        const avatarPath = `/avatars/${req.file.filename}`;
        const fullUrl = publicAsset(req, avatarPath);

        // Cập nhật DB
        const [result] = await pool.execute(
            'UPDATE Users SET AvatarUrl = ? WHERE UserId = ? AND IsActive = 1',
            [avatarPath, req.user.userId]
        );

        if (result.affectedRows !== 1) {
            const avatarCleanupPending=await removeUploadedAvatar(req.file.filename);
            return res.status(401).json({error:'Tài khoản không còn hoạt động.',...(avatarCleanupPending?{avatarCleanupPending:true}:{})});
        }
        // Trả về full URL

        res.json({ message: 'Cập nhật ảnh đại diện thành công!', avatar: fullUrl });
    } catch (error) {
        const avatarCleanupPending=req.file?.filename ? await removeUploadedAvatar(req.file.filename) : false;
        console.error('UploadAvatar error:', error.code || 'UPLOAD_ERROR');
        res.status(500).json({ error: 'Lỗi khi upload ảnh đại diện',...(avatarCleanupPending?{avatarCleanupPending:true}:{}) });
    }
};
