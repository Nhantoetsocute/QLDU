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
            ORDER BY g.CreatedAt DESC
        `;
        const [rows] = await pool.execute(sql, [req.user.userId]);
        res.json(rows);
    } catch (error) {
        console.error('GetCart error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Thêm món vào giỏ (nếu có rồi thì tăng số lượng) — Dùng INSERT ON DUPLICATE tối ưu
exports.addToCart = async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user.userId;
    
    if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ error: "productId và quantity là bắt buộc (quantity >= 1)" });
    }

    try {
        // Kiểm tra sản phẩm tồn tại & còn hàng
        const [product] = await pool.execute(
            "SELECT FoodId, Stock, IsActive FROM Food WHERE FoodId = ? LIMIT 1",
            [productId]
        );
        if (product.length === 0 || !product[0].IsActive) {
            return res.status(404).json({ error: "Sản phẩm không tồn tại hoặc đã ngừng bán" });
        }
        if (product[0].Stock < quantity) {
            return res.status(400).json({ error: `Chỉ còn ${product[0].Stock} sản phẩm trong kho` });
        }

        // Upsert: Thêm mới hoặc tăng số lượng (1 query thay vì 2)
        const [existing] = await pool.execute(
            "SELECT GioHangId, Quantity FROM GioHang WHERE UserId = ? AND FoodId = ?", 
            [userId, productId]
        );

        if (existing.length > 0) {
            await pool.execute(
                "UPDATE GioHang SET Quantity = Quantity + ? WHERE GioHangId = ?",
                [quantity, existing[0].GioHangId]
            );
        } else {
            await pool.execute(
                "INSERT INTO GioHang (UserId, FoodId, Quantity) VALUES (?, ?, ?)",
                [userId, productId, quantity]
            );
        }
        res.status(201).json({ message: "Thêm vào giỏ hàng thành công!" });
    } catch (error) {
        console.error('AddToCart error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Cập nhật số lượng
exports.updateCartItem = async (req, res) => {
    const { quantity } = req.body;
    const cartId = req.params.id;

    if (!quantity || quantity < 1) {
        return res.status(400).json({ error: "Số lượng phải >= 1" });
    }

    try {
        const [result] = await pool.execute(
            "UPDATE GioHang SET Quantity = ? WHERE GioHangId = ? AND UserId = ?",
            [quantity, cartId, req.user.userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Không tìm thấy mục giỏ hàng" });
        }
        res.json({ message: "Cập nhật thành công!" });
    } catch (error) {
        console.error('UpdateCartItem error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Xóa món khỏi giỏ
exports.removeFromCart = async (req, res) => {
    const cartId = req.params.id;
    try {
        const [result] = await pool.execute(
            "DELETE FROM GioHang WHERE GioHangId = ? AND UserId = ?",
            [cartId, req.user.userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Không tìm thấy mục giỏ hàng" });
        }
        res.json({ message: "Xóa thành công!" });
    } catch (error) {
        console.error('RemoveFromCart error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Xóa toàn bộ giỏ hàng
exports.clearCart = async (req, res) => {
    try {
        await pool.execute("DELETE FROM GioHang WHERE UserId = ?", [req.user.userId]);
        res.json({ message: "Đã xóa toàn bộ giỏ hàng" });
    } catch (error) {
        console.error('ClearCart error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
