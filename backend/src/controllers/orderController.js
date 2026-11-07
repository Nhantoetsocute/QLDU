const { openField, revealRow } = require('../security/dataFields');
const { publicAsset } = require('../security/output');
const security = require('../services/orderSecurityService');
const pool = require('../config/db');

// Lịch sử đơn hàng — Tối ưu: dùng JOIN thay vì subquery
exports.getOrderHistory = async (req, res) => {
    try {
        const sql = `
            SELECT
                o.OrderId as _id,
                o.OrderCode as id,
                DATE_FORMAT(o.OrderDate, '%H:%i - %d/%m/%Y') as date,
                s.StatusName as status,
                'Delivery' as type,
                CONCAT(FORMAT(o.TotalAmount, 0), ' đ') as total,
                p.TenPhuongThuc as payment,
                o.DeliveryAddress as address,
                IFNULL(SUM(od.Quantity), 0) as itemCount,
                (SELECT GROUP_CONCAT(CONCAT(f2.FoodName, ' (x', od2.Quantity, ')') SEPARATOR ', ')
                 FROM OrderDetails od2
                 JOIN Food f2 ON od2.FoodId = f2.FoodId
                 WHERE od2.OrderId = o.OrderId) as allItems,
                (SELECT f2.FoodName FROM OrderDetails od2
                 JOIN Food f2 ON od2.FoodId = f2.FoodId
                 WHERE od2.OrderId = o.OrderId
                 ORDER BY od2.OrderDetailId ASC LIMIT 1) as mainItem,
                (SELECT f2.ImageUrl FROM OrderDetails od2
                 JOIN Food f2 ON od2.FoodId = f2.FoodId
                 WHERE od2.OrderId = o.OrderId
                 ORDER BY od2.OrderDetailId ASC LIMIT 1) as image
            FROM Orders o
            LEFT JOIN OrderStatus s ON o.StatusId = s.StatusId
            LEFT JOIN PhuongThucThanhToan p ON o.PaymentMethodId = p.PaymentMethodId
            LEFT JOIN OrderDetails od ON od.OrderId = o.OrderId
            WHERE o.UserId = ?
            GROUP BY o.OrderId, o.OrderCode, o.OrderDate, s.StatusName,
                     o.TotalAmount, p.TenPhuongThuc, o.DeliveryAddress
            ORDER BY o.OrderDate DESC
            LIMIT 50
        `;
        const [rows] = await pool.execute(sql, [req.user.userId]);

        // Map status names to frontend convention + build full image URL
        const statusMap = { preparing: 'preparing', shipping: 'shipping', completed: 'delivered', cancelled: 'cancelled' };
        const mappedRows = rows.map(r => ({
            ...r,
            address: openField('Orders',r._id,'DeliveryAddress',r.address),
            status: statusMap[r.status] || 'preparing',
            image: publicAsset(req, r.image)
        }));

        res.json(mappedRows);
    } catch (error) {
        console.error('GetOrderHistory error:', error.code || 'REQUEST_FAILED');
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Tạo đơn hàng — Hỗ trợ cả giỏ hàng từ DB (GioHang) và từ frontend (items trong body)
exports.createOrder = async (req, res, next) => {
    try {
        const result = await security.transaction(pool, c => security.createOrder(c, req.user.userId, req.body));
        res.status(201).json({ message:'Đặt hàng thành công!', ...result });
    } catch (error) { next(error); }
};

// Chi tiết 1 đơn — Tối ưu: trả cả danh sách món
exports.getOrderById = async (req, res) => {
    try {
        const [orders] = await pool.execute(
            `SELECT o.OrderId, o.OrderCode, o.OrderDate, o.TotalAmount, o.StatusId, o.PaymentMethodId, o.ReceiverName, o.ReceiverPhone, o.DeliveryAddress, o.Note, s.StatusName as status, p.TenPhuongThuc as paymentMethod, pt.State as paymentStatus
             FROM Orders o
             LEFT JOIN OrderStatus s ON o.StatusId = s.StatusId
             LEFT JOIN PhuongThucThanhToan p ON o.PaymentMethodId = p.PaymentMethodId
             LEFT JOIN PaymentTransactions pt ON pt.OrderId = o.OrderId
             WHERE o.OrderId = ? AND o.UserId = ?`,
            [req.params.id, req.user.userId]
        );
        if (orders.length === 0) return res.status(404).json({ error: "Không tìm thấy đơn" });

        // Lấy danh sách món trong đơn
        const [items] = await pool.execute(
            `SELECT od.OrderDetailId, od.FoodId, od.Quantity, od.UnitPrice, od.LineTotal, f.FoodName, f.ImageUrl
             FROM OrderDetails od
             JOIN Food f ON od.FoodId = f.FoodId
             WHERE od.OrderId = ?`,
            [req.params.id]
        );

        res.json({ order: revealRow('Orders',orders[0]), items });
    } catch (error) {
        console.error('GetOrderById error:', error.code || 'REQUEST_FAILED');
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Hủy đơn hàng — Chỉ cho phép hủy khi đang ở trạng thái "preparing" (StatusId = 1)
exports.cancelOrder = async (req, res, next) => {
    try {
        const result = await security.transaction(pool, c => security.cancelOrder(c, req.user.userId, req.params.id));
        res.json({ message:'Đơn hàng đã được hủy thành công', ...result });
    } catch (error) { next(error); }
};
