const pool = require('../config/db');

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
                AvatarUrl as avatarUri 
            FROM Users 
            WHERE UserId = ?`, 
            [req.user.userId]
        );
        if (users.length === 0) return res.status(404).json({ error: "Không tìm thấy user" });
        res.json(users[0]);
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
            `SELECT UserName as name, Email as email, Phone as phone, Address as address, AvatarUrl as avatarUri 
             FROM Users WHERE UserId = ?`,
            [req.user.userId]
        );

        res.json({ message: "Cập nhật thành công!", profile: updated[0] });
    } catch (error) {
        console.error('UpdateProfile error:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Số điện thoại đã được sử dụng" });
        }
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
