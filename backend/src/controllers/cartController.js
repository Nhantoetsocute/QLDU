const pool = require('../config/db');

// Lấy giỏ hàng
exports.getCart = async (req, res) => {
    try {
        const sql = `
            SELECT 
                g.GioHangId as id, 
                f.FoodId as productId,
                f.FoodName as name, 
                f.BasePrice as price, 
                f.ImageUrl as image, 
                g.Quantity as quantity
            FROM GioHang g
            INNER JOIN Food f ON g.FoodId = f.FoodId
            WHERE g.UserId = ?
        `;
        const [rows] = await pool.execute(sql, [req.user.userId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Thêm món vào giỏ (nếu có rồi thì tăng số lượng)
exports.addToCart = async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user.userId;
    try {
        // Kiểm tra xem đã có trong giỏ chưa
        const [existing] = await pool.execute(
            "SELECT GioHangId, Quantity FROM GioHang WHERE UserId = ? AND FoodId = ?", 
            [userId, productId]
        );

        if (existing.length > 0) {
            // Đã có -> Update số lượng
            await pool.execute(
                "UPDATE GioHang SET Quantity = Quantity + ? WHERE GioHangId = ?",
                [quantity, existing[0].GioHangId]
            );
        } else {
            // Chưa có -> Thêm mới
            await pool.execute(
                "INSERT INTO GioHang (UserId, FoodId, Quantity) VALUES (?, ?, ?)",
                [userId, productId, quantity]
            );
        }
        res.status(201).json({ message: "Thêm vào giỏ hàng thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Cập nhật số lượng
exports.updateCartItem = async (req, res) => {
    const { quantity } = req.body;
    const cartId = req.params.id;
    try {
        await pool.execute(
            "UPDATE GioHang SET Quantity = ? WHERE GioHangId = ? AND UserId = ?",
            [quantity, cartId, req.user.userId]
        );
        res.json({ message: "Cập nhật thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Xóa món khỏi giỏ
exports.removeFromCart = async (req, res) => {
    const cartId = req.params.id;
    try {
        await pool.execute(
            "DELETE FROM GioHang WHERE GioHangId = ? AND UserId = ?",
            [cartId, req.user.userId]
        );
        res.json({ message: "Xóa thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
