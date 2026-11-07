const pool = require('../config/db');
const security = require('../services/orderSecurityService');
const { schemas } = require('../security/validation');

function reject(message, status) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

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
        console.error('GetCart error:', error.code || 'DATABASE_ERROR');
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Mutations lock the account before cart rows so account closure cannot be raced.
exports.addToCart = async (req, res, next) => {
    try {
        const { productId, quantity } = schemas.cart(req.body);
        const userId = req.user.userId;
        await security.transaction(pool, async (connection) => {
            await security.lockActiveAccount(connection, userId);
            const [products] = await connection.execute(
                'SELECT FoodId, Stock, IsActive FROM Food WHERE FoodId = ? LIMIT 1 FOR UPDATE',
                [productId]
            );
            const product = products[0];
            if (!product || Number(product.IsActive) !== 1) reject('Sản phẩm không tồn tại hoặc đã ngừng bán.', 404);
            if (Number(product.Stock) < quantity) reject('Sản phẩm không đủ tồn kho.', 400);
            const [existing] = await connection.execute(
                'SELECT GioHangId, Quantity FROM GioHang WHERE UserId = ? AND FoodId = ? FOR UPDATE',
                [userId, productId]
            );
            if (Number(existing[0]?.Quantity || 0) + quantity > Math.min(99, Number(product.Stock))) {
                reject('Số lượng giỏ hàng vượt giới hạn hoặc tồn kho.', 400);
            }
            if (existing.length) {
                const [updated] = await connection.execute(
                    'UPDATE GioHang g JOIN Food f ON f.FoodId = g.FoodId SET g.Quantity = g.Quantity + ? WHERE g.GioHangId = ? AND g.UserId = ? AND f.IsActive = 1 AND g.Quantity + ? <= LEAST(99, f.Stock)',
                    [quantity, existing[0].GioHangId, userId, quantity]
                );
                if (updated.affectedRows !== 1) reject('Giỏ hàng hoặc tồn kho đã thay đổi.', 409);
            } else {
                await connection.execute('INSERT INTO GioHang (UserId, FoodId, Quantity) VALUES (?, ?, ?)', [userId, productId, quantity]);
            }
        });
        res.status(201).json({ message: 'Thêm vào giỏ hàng thành công!' });
    } catch (error) { next(error); }
};

exports.updateCartItem = async (req, res, next) => {
    try {
        const { quantity } = schemas.quantity(req.body);
        await security.transaction(pool, async (connection) => {
            await security.lockActiveAccount(connection, req.user.userId);
            const [result] = await connection.execute(
                'UPDATE GioHang g JOIN Food f ON f.FoodId = g.FoodId SET g.Quantity = ? WHERE g.GioHangId = ? AND g.UserId = ? AND f.IsActive = 1 AND f.Stock >= ?',
                [quantity, req.params.id, req.user.userId, quantity]
            );
            if (result.affectedRows === 0) reject('Không tìm thấy mục giỏ hàng hoặc không đủ tồn kho.', 404);
        });
        res.json({ message: 'Cập nhật thành công!' });
    } catch (error) { next(error); }
};

exports.removeFromCart = async (req, res, next) => {
    try {
        await security.transaction(pool, async (connection) => {
            await security.lockActiveAccount(connection, req.user.userId);
            const [result] = await connection.execute(
                'DELETE FROM GioHang WHERE GioHangId = ? AND UserId = ?',
                [req.params.id, req.user.userId]
            );
            if (result.affectedRows === 0) reject('Không tìm thấy mục giỏ hàng.', 404);
        });
        res.json({ message: 'Xóa thành công!' });
    } catch (error) { next(error); }
};

exports.clearCart = async (req, res, next) => {
    try {
        await security.transaction(pool, async (connection) => {
            await security.lockActiveAccount(connection, req.user.userId);
            await connection.execute('DELETE FROM GioHang WHERE UserId = ?', [req.user.userId]);
        });
        res.json({ message: 'Đã xóa toàn bộ giỏ hàng' });
    } catch (error) { next(error); }
};
