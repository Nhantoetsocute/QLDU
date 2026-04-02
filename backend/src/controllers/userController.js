const pool = require('../config/db');

// Lấy thông tin cá nhân (Profile)
exports.getProfile = async (req, res) => {
    try {
        const [users] = await pool.execute(
            "SELECT UserId, UserCode, UserName as name, Email as email, Phone as phone, Address as address, AvatarUrl as avatarUri FROM Users WHERE UserId = ?", 
            [req.user.userId]
        );
        if (users.length === 0) return res.status(404).json({ error: "Không tìm thấy user" });
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Cập nhật thông tin cá nhân
exports.updateProfile = async (req, res) => {
    const { name, phone, address } = req.body;
    try {
        await pool.execute(
            "UPDATE Users SET UserName = ?, Phone = ?, Address = ? WHERE UserId = ?",
            [name || null, phone || null, address || null, req.user.userId]
        );
        res.json({ message: "Cập nhật thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
