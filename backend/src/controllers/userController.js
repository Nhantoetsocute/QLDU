const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

// Đảm bảo thư mục avatars tồn tại
const avatarsDir = path.join(__dirname, '../../public/avatars');
if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
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
        if (user.avatar) {
            const reqHost = req.headers['host'] || `localhost:${process.env.PORT || 3000}`;
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            user.avatar = `${protocol}://${reqHost}${user.avatar}`;
        }
        res.json(user);
    } catch (error) {
        console.error('GetProfile error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Cập nhật thông tin cá nhân
exports.updateProfile = async (req, res) => {
    const { name, phone, address } = req.body;
    
    // Validate: ít nhất 1 trường phải có
    if (!name && !phone && !address) {
        return res.status(400).json({ error: "Cần ít nhất 1 trường để cập nhật" });
    }

    try {
        // Chỉ update các trường được gửi lên (không ghi null thừa)
        const fields = [];
        const values = [];
        
        if (name !== undefined) { fields.push('UserName = ?'); values.push(name.trim()); }
        if (phone !== undefined) { fields.push('Phone = ?'); values.push(phone.trim() || null); }
        if (address !== undefined) { fields.push('Address = ?'); values.push(address.trim() || null); }
        
        values.push(req.user.userId);

        await pool.execute(
            `UPDATE Users SET ${fields.join(', ')} WHERE UserId = ?`,
            values
        );

        // Trả về profile mới sau khi update (để FE đồng bộ ngay)
        const [updated] = await pool.execute(
            `SELECT UserName as name, Email as email, Phone as phone, Address as address, AvatarUrl as avatar 
             FROM Users WHERE UserId = ?`,
            [req.user.userId]
        );

        // Build full URL cho avatar
        const profile = updated[0];
        if (profile.avatar) {
            const reqHost = req.headers['host'] || `localhost:${process.env.PORT || 3000}`;
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            profile.avatar = `${protocol}://${reqHost}${profile.avatar}`;
        }

        res.json({ message: "Cập nhật thành công!", profile });
    } catch (error) {
        console.error('UpdateProfile error:', error.message);
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

        // Xóa avatar cũ nếu có
        const [oldUser] = await pool.execute(
            'SELECT AvatarUrl FROM Users WHERE UserId = ?',
            [req.user.userId]
        );
        if (oldUser[0]?.AvatarUrl) {
            const oldPath = path.join(__dirname, '../../public', oldUser[0].AvatarUrl);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        // Cập nhật DB
        await pool.execute(
            'UPDATE Users SET AvatarUrl = ? WHERE UserId = ?',
            [avatarPath, req.user.userId]
        );

        // Trả về full URL
        const reqHost = req.headers['host'] || `localhost:${process.env.PORT || 3000}`;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const fullUrl = `${protocol}://${reqHost}${avatarPath}`;

        res.json({ message: 'Cập nhật ảnh đại diện thành công!', avatar: fullUrl });
    } catch (error) {
        console.error('UploadAvatar error:', error.message);
        res.status(500).json({ error: 'Lỗi khi upload ảnh đại diện' });
    }
};
