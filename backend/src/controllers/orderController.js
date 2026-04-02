const pool = require('../config/db');

// Lịch sử đơn hàng
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
                (SELECT COUNT(*) FROM OrderDetails od WHERE od.OrderId = o.OrderId) as itemCount,
                (SELECT f.FoodName FROM OrderDetails od JOIN Food f ON od.FoodId = f.FoodId WHERE od.OrderId = o.OrderId LIMIT 1) as mainItem,
                (SELECT f.ImageUrl FROM OrderDetails od JOIN Food f ON od.FoodId = f.FoodId WHERE od.OrderId = o.OrderId LIMIT 1) as image
            FROM Orders o
            LEFT JOIN OrderStatus s ON o.StatusId = s.StatusId
            LEFT JOIN PhuongThucThanhToan p ON o.PaymentMethodId = p.PaymentMethodId
            WHERE o.UserId = ?
            ORDER BY o.OrderDate DESC
        `;
        const [rows] = await pool.execute(sql, [req.user.userId]);
        
        // Map ENUM to match frontend colors: preparing, shipping, delivered, cancelled
        const mappedRows = rows.map(r => {
            let mappedStatus = 'preparing';
            if(r.status === 'shipping') mappedStatus = 'shipping';
            if(r.status === 'completed') mappedStatus = 'delivered';
            if(r.status === 'cancelled') mappedStatus = 'cancelled';
            return { ...r, status: mappedStatus };
        });

        res.json(mappedRows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Tạo đơn hàng từ giỏ hàng hiện tại
exports.createOrder = async (req, res) => {
    const { paymentMethodId, receiverName, receiverPhone, deliveryAddress, note, voucherId } = req.body;
    const userId = req.user.userId;
    
    const connection = await pool.getConnection(); // Dùng transaction
    
    try {
        await connection.beginTransaction();

        // 1. Lấy giỏ hàng
        const [cartItems] = await connection.execute(`
            SELECT g.FoodId, g.Quantity, f.BasePrice 
            FROM GioHang g 
            JOIN Food f ON g.FoodId = f.FoodId 
            WHERE g.UserId = ?
        `, [userId]);

        if (cartItems.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: "Giỏ hàng trống" });
        }

        // Tính tổng tiền
        let totalAmount = cartItems.reduce((sum, item) => sum + (item.Quantity * item.BasePrice), 0);

        // Sinh OrderCode (VD: ORD231015-xxxx)
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const orderCode = `ORD${dateStr}${randomSuffix}`;

        // 2. Insert Orders
        const statusId = 1; // Default: 1 (preparing)
        // Lưu ý: voucherId phải có thể null, hiện tại FE chưa truyền chuẩn
        const [orderResult] = await connection.execute(
            `INSERT INTO Orders (OrderCode, UserId, TotalAmount, PaymentMethodId, StatusId, VoucherId, ReceiverName, ReceiverPhone, DeliveryAddress, Note) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderCode, userId, totalAmount, paymentMethodId || 1, statusId, voucherId || null, receiverName || 'Unknown', receiverPhone || 'Unknown', deliveryAddress || 'Unknown', note || '']
        );
        const orderId = orderResult.insertId;

        // 3. Insert OrderDetails
        for (const item of cartItems) {
            const lineTotal = item.Quantity * item.BasePrice;
            await connection.execute(
                `INSERT INTO OrderDetails (OrderId, FoodId, Quantity, UnitPrice, LineTotal) VALUES (?, ?, ?, ?, ?)`,
                [orderId, item.FoodId, item.Quantity, item.BasePrice, lineTotal]
            );
            // Giảm số lượng Stock (Nghiệp vụ kho cơ bản)
            await connection.execute(`UPDATE Food SET Stock = Stock - ? WHERE FoodId = ?`, [item.Quantity, item.FoodId]);
        }

        // 4. Xóa Giỏ hàng cũ
        await connection.execute(`DELETE FROM GioHang WHERE UserId = ?`, [userId]);

        await connection.commit();
        res.status(201).json({ message: "Đặt hàng thành công!", orderId, orderCode });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: "Lỗi tạo đơn hàng" });
    } finally {
        connection.release();
    }
};

// Chi tiết 1 đơn
exports.getOrderById = async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM Orders WHERE OrderId = ? AND UserId = ?`, [req.params.id, req.user.userId]);
        if (rows.length === 0) return res.status(404).json({ error: "Không tìm thấy đơn" });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
