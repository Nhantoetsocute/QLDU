const pool = require('../config/db');

exports.getVouchers = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT VoucherId as id, Code as code, DiscountAmount as discount, 
                   DiscountPercentage as percentage, MinOrderAmount as minOrder, 
                   ExpiryDate as expiryDate 
            FROM Vouchers 
            WHERE IsActive = 1 AND ExpiryDate > NOW()
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
