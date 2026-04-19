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
                COUNT(od.OrderDetailId) as itemCount,
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
        
        // Xây dựng base URL cho ảnh
        const reqHost = req.headers['host'] || `localhost:${process.env.PORT || 3000}`;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const baseUrl = `${protocol}://${reqHost}`;

        // Map status names to frontend convention + build full image URL
        const statusMap = { preparing: 'preparing', shipping: 'shipping', completed: 'delivered', cancelled: 'cancelled' };
        const mappedRows = rows.map(r => ({
            ...r,
            status: statusMap[r.status] || 'preparing',
            image: r.image ? `${baseUrl}${r.image}` : null
        }));

        res.json(mappedRows);
    } catch (error) {
        console.error('GetOrderHistory error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Tạo đơn hàng — Tối ưu: batch insert + voucher discount
exports.createOrder = async (req, res) => {
    const { paymentMethodId, receiverName, receiverPhone, deliveryAddress, note, voucherId } = req.body;
    const userId = req.user.userId;

    // Validate thông tin bắt buộc
    if (!receiverName || !receiverPhone || !deliveryAddress) {
        return res.status(400).json({ error: "Vui lòng nhập đầy đủ tên, SĐT và địa chỉ" });
    }
    
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. Lấy giỏ hàng + kiểm tra stock cùng lúc
        const [cartItems] = await connection.execute(`
            SELECT g.FoodId, g.Quantity, f.BasePrice, f.Stock, f.FoodName
            FROM GioHang g 
            JOIN Food f ON g.FoodId = f.FoodId 
            WHERE g.UserId = ?
        `, [userId]);

        if (cartItems.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: "Giỏ hàng trống" });
        }

        // Kiểm tra stock trước khi tạo đơn
        for (const item of cartItems) {
            if (item.Stock < item.Quantity) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: `"${item.FoodName}" chỉ còn ${item.Stock} sản phẩm, bạn đặt ${item.Quantity}` 
                });
            }
        }

        // Tính tổng tiền
        let totalAmount = cartItems.reduce((sum, item) => sum + (item.Quantity * item.BasePrice), 0);

        // Áp dụng voucher nếu có
        if (voucherId) {
            const [vouchers] = await connection.execute(
                "SELECT DiscountAmount, DiscountPercentage, MinOrderAmount FROM Vouchers WHERE VoucherId = ? AND IsActive = 1 AND ExpiryDate > NOW()",
                [voucherId]
            );
            if (vouchers.length > 0) {
                const v = vouchers[0];
                if (totalAmount >= v.MinOrderAmount) {
                    const discountVal = v.DiscountAmount > 0 
                        ? v.DiscountAmount 
                        : Math.round(totalAmount * v.DiscountPercentage / 100);
                    totalAmount = Math.max(0, totalAmount - discountVal);
                }
            }
        }

        // Sinh OrderCode
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const orderCode = `ORD${dateStr}${randomSuffix}`;

        // 2. Insert Orders
        const [orderResult] = await connection.execute(
            `INSERT INTO Orders (OrderCode, UserId, TotalAmount, PaymentMethodId, StatusId, VoucherId, ReceiverName, ReceiverPhone, DeliveryAddress, Note) 
             VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
            [orderCode, userId, totalAmount, paymentMethodId || 1, voucherId || null, 
             receiverName.trim(), receiverPhone.trim(), deliveryAddress.trim(), note || '']
        );
        const orderId = orderResult.insertId;

        // 3. Batch insert OrderDetails + update stock 
        const detailValues = cartItems.map(item => 
            [orderId, item.FoodId, item.Quantity, item.BasePrice, item.Quantity * item.BasePrice]
        );
        
        for (const vals of detailValues) {
            await connection.execute(
                `INSERT INTO OrderDetails (OrderId, FoodId, Quantity, UnitPrice, LineTotal) VALUES (?, ?, ?, ?, ?)`,
                vals
            );
        }
        
        // Update stock cho tất cả sản phẩm
        for (const item of cartItems) {
            await connection.execute(
                `UPDATE Food SET Stock = GREATEST(0, Stock - ?) WHERE FoodId = ?`, 
                [item.Quantity, item.FoodId]
            );
        }

        // 4. Xóa Giỏ hàng
        await connection.execute(`DELETE FROM GioHang WHERE UserId = ?`, [userId]);

        await connection.commit();
        res.status(201).json({ message: "Đặt hàng thành công!", orderId, orderCode, totalAmount });

    } catch (error) {
        await connection.rollback();
        console.error('CreateOrder error:', error.message);
        res.status(500).json({ error: "Lỗi tạo đơn hàng" });
    } finally {
        connection.release();
    }
};

// Chi tiết 1 đơn — Tối ưu: trả cả danh sách món
exports.getOrderById = async (req, res) => {
    try {
        const [orders] = await pool.execute(
            `SELECT o.*, s.StatusName as status, p.TenPhuongThuc as paymentMethod
             FROM Orders o
             LEFT JOIN OrderStatus s ON o.StatusId = s.StatusId
             LEFT JOIN PhuongThucThanhToan p ON o.PaymentMethodId = p.PaymentMethodId
             WHERE o.OrderId = ? AND o.UserId = ?`, 
            [req.params.id, req.user.userId]
        );
        if (orders.length === 0) return res.status(404).json({ error: "Không tìm thấy đơn" });

        // Lấy danh sách món trong đơn
        const [items] = await pool.execute(
            `SELECT od.*, f.FoodName, f.ImageUrl 
             FROM OrderDetails od 
             JOIN Food f ON od.FoodId = f.FoodId 
             WHERE od.OrderId = ?`,
            [req.params.id]
        );

        res.json({ order: orders[0], items });
    } catch (error) {
        console.error('GetOrderById error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
