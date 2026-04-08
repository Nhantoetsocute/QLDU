const pool = require('../config/db');

// Lấy danh sách voucher còn hiệu lực
exports.getVouchers = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT VoucherId as id, Code as code, DiscountAmount as discount, 
                   DiscountPercentage as percentage, MinOrderAmount as minOrder, 
                   DATE_FORMAT(ExpiryDate, '%d/%m/%Y') as expiryDate
            FROM Vouchers 
            WHERE IsActive = 1 AND ExpiryDate > NOW()
            ORDER BY ExpiryDate ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('GetVouchers error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Validate voucher code
exports.validateVoucher = async (req, res) => {
    const { code, orderAmount } = req.body;
    if (!code) {
        return res.status(400).json({ error: "Vui lòng nhập mã voucher" });
    }

    try {
        const [vouchers] = await pool.execute(`
            SELECT VoucherId as id, Code as code, DiscountAmount as discount, 
                   DiscountPercentage as percentage, MinOrderAmount as minOrder
            FROM Vouchers 
            WHERE Code = ? AND IsActive = 1 AND ExpiryDate > NOW()
            LIMIT 1
        `, [code.trim().toUpperCase()]);

        if (vouchers.length === 0) {
            return res.status(404).json({ error: "Mã voucher không hợp lệ hoặc đã hết hạn" });
        }

        const voucher = vouchers[0];
        if (orderAmount && orderAmount < voucher.minOrder) {
            return res.status(400).json({ 
                error: `Đơn hàng tối thiểu ${voucher.minOrder.toLocaleString('vi-VN')}đ để dùng mã này`,
                minOrder: voucher.minOrder
            });
        }

        const discountAmount = voucher.discount > 0 
            ? voucher.discount 
            : Math.round((orderAmount || 0) * voucher.percentage / 100);

        res.json({ 
            valid: true, 
            voucher,
            discountAmount,
            message: `Giảm ${discountAmount.toLocaleString('vi-VN')}đ` 
        });
    } catch (error) {
        console.error('ValidateVoucher error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
