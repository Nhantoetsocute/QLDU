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

// Tạo đơn hàng — Hỗ trợ cả giỏ hàng từ DB (GioHang) và từ frontend (items trong body)
exports.createOrder = async (req, res) => {
    const { paymentMethodId, receiverName, receiverPhone, deliveryAddress, note, voucherId, items } = req.body;
    const userId = req.user.userId;

    // Validate thông tin bắt buộc
    if (!receiverName || !receiverPhone || !deliveryAddress) {
        return res.status(400).json({ error: "Vui lòng nhập đầy đủ tên, SĐT và địa chỉ" });
    }
    
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        let cartItems = [];
        let usingFrontendCart = false;

        // Nếu frontend gửi items trực tiếp (từ CartContext/AsyncStorage hoặc mua ngay)
        if (items && Array.isArray(items) && items.length > 0) {
            usingFrontendCart = true;
            // Lấy thông tin sản phẩm từ DB để validate giá và stock
            const foodIds = items.map(i => i.productId || i.id);
            const placeholders = foodIds.map(() => '?').join(',');
            const [foods] = await connection.execute(
                `SELECT FoodId, FoodName, BasePrice, Stock FROM Food WHERE FoodId IN (${placeholders})`,
                foodIds
            );

            const foodMap = {};
            for (const f of foods) {
                foodMap[f.FoodId] = f;
            }

            for (const item of items) {
                const foodId = item.productId || item.id;
                const food = foodMap[foodId];
                if (!food) {
                    await connection.rollback();
                    return res.status(400).json({ error: `Sản phẩm "${item.name || foodId}" không tồn tại` });
                }
                cartItems.push({
                    FoodId: food.FoodId,
                    FoodName: food.FoodName,
                    Quantity: item.quantity || 1,
                    BasePrice: food.BasePrice,
                    Stock: food.Stock,
                });
            }
        } else {
            // Fallback: lấy giỏ hàng từ bảng GioHang trong DB
            const [dbCartItems] = await connection.execute(`
                SELECT g.FoodId, g.Quantity, f.BasePrice, f.Stock, f.FoodName
                FROM GioHang g 
                JOIN Food f ON g.FoodId = f.FoodId 
                WHERE g.UserId = ?
            `, [userId]);
            cartItems = dbCartItems;
        }

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

        // 4. Xóa giỏ hàng DB (nếu dùng DB cart)
        if (!usingFrontendCart) {
            await connection.execute(`DELETE FROM GioHang WHERE UserId = ?`, [userId]);
        }

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

// Hủy đơn hàng — Chỉ cho phép hủy khi đang ở trạng thái "preparing" (StatusId = 1)
exports.cancelOrder = async (req, res) => {
    const orderId = req.params.id;
    const userId = req.user.userId;

    try {
        // Kiểm tra đơn hàng tồn tại và thuộc về user
        const [orders] = await pool.execute(
            `SELECT OrderId, StatusId, OrderCode FROM Orders WHERE OrderId = ? AND UserId = ?`,
            [orderId, userId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
        }

        const order = orders[0];

        // Chỉ cho phép hủy khi đang chuẩn bị (StatusId = 1)
        if (order.StatusId !== 1) {
            return res.status(400).json({ error: "Chỉ có thể hủy đơn hàng đang ở trạng thái 'Đang chuẩn bị'" });
        }

        // Cập nhật trạng thái thành cancelled (StatusId = 4)
        await pool.execute(
            `UPDATE Orders SET StatusId = 4 WHERE OrderId = ?`,
            [orderId]
        );

        // Hoàn lại stock cho các sản phẩm trong đơn
        const [orderDetails] = await pool.execute(
            `SELECT FoodId, Quantity FROM OrderDetails WHERE OrderId = ?`,
            [orderId]
        );
        for (const detail of orderDetails) {
            await pool.execute(
                `UPDATE Food SET Stock = Stock + ? WHERE FoodId = ?`,
                [detail.Quantity, detail.FoodId]
            );
        }

        res.json({ message: "Đơn hàng đã được hủy thành công", orderCode: order.OrderCode });
    } catch (error) {
        console.error('CancelOrder error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
