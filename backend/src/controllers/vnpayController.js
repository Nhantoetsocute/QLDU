const { VNPay, ProductCode, VnpLocale } = require('vnpay');
const pool = require('../config/db');

// ============================================================
// VNPay Configuration
// ============================================================
const vnpay = new VNPay({
    tmnCode: process.env.VNP_TMN_CODE,
    secureSecret: process.env.VNP_HASH_SECRET,
    vnpayHost: process.env.VNP_HOST || 'https://sandbox.vnpayment.vn',
    testMode: process.env.VNP_TEST_MODE !== 'false',
    hashAlgorithm: 'SHA512',
    enableLog: false,
});

// ============================================================
// 1) POST /api/vnpay/create-payment-url
//    Tao don hang trong DB + sinh URL thanh toan VNPay
// ============================================================
exports.createPaymentUrl = async (req, res) => {
    const {
        amount,
        orderInfo,
        receiverName,
        receiverPhone,
        deliveryAddress,
        note,
        voucherId,
        cartItems: clientCartItems,
    } = req.body;
    const userId = req.user.userId;

    // DEBUG
    console.log('=== VNPay req.body ===', JSON.stringify(req.body, null, 2));

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let totalAmount = 0;
        let orderCode = '';
        let orderId = null;

        if (req.body.type === 'reservation') {
            totalAmount = amount;
            const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            orderCode = `RES${dateStr}${randomSuffix}`;

            const [orderResult] = await connection.execute(
                `INSERT INTO Orders (OrderCode, UserId, TotalAmount, PaymentMethodId, StatusId, ReceiverName, ReceiverPhone, DeliveryAddress, Note) 
                 VALUES (?, ?, ?, 2, 1, ?, ?, ?, ?)`,
                [orderCode, userId, totalAmount, receiverName || 'Khách đặt bàn', receiverPhone || 'N/A', deliveryAddress || 'Tại cửa hàng', note || orderInfo || '']
            );
            orderId = orderResult.insertId;
        } else {
            // Validate
            if (!amount || amount <= 0) {
                return res.status(400).json({ message: 'So tien khong hop le' });
            }
            if (!receiverName || !receiverPhone || !deliveryAddress) {
                return res.status(400).json({ message: 'Vui long nhap day du thong tin giao hang' });
            }
            if (!clientCartItems || !Array.isArray(clientCartItems) || clientCartItems.length === 0) {
                return res.status(400).json({ message: 'Gio hang trong' });
            }

        // -- Verify gia + stock tu DB cho tung item trong gio hang --
            const cartItems = [];
            for (const ci of clientCartItems) {
                const foodId = ci.productId || ci.id;
                const quantity = ci.quantity || 1;
                if (!foodId || quantity < 1) continue;

                const [foods] = await connection.execute(
                    `SELECT FoodId, FoodName, BasePrice, Stock FROM Food WHERE FoodId = ? AND IsActive = 1`,
                    [foodId]
                );
                if (foods.length === 0) continue;

                const food = foods[0];
                if (food.Stock < quantity) {
                    await connection.rollback();
                    return res.status(400).json({
                        message: `"${food.FoodName}" chi con ${food.Stock} san pham, ban dat ${quantity}`
                    });
                }

                cartItems.push({
                    FoodId: food.FoodId,
                    FoodName: food.FoodName,
                    BasePrice: food.BasePrice,
                    Quantity: quantity,
                });
            }

            if (cartItems.length === 0) {
                await connection.rollback();
                return res.status(400).json({ message: 'Khong co san pham hop le trong gio hang' });
            }

            // -- Tinh tong tien --
            totalAmount = cartItems.reduce((sum, item) => sum + (item.Quantity * item.BasePrice), 0);

            // Ap dung voucher neu co
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

            // -- Sinh OrderCode --
            const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            orderCode = `ORD${dateStr}${randomSuffix}`;

            // -- Insert don hang (PaymentMethodId = 2 = VNPAY, StatusId = 1 = preparing) --
            const [orderResult] = await connection.execute(
                `INSERT INTO Orders (OrderCode, UserId, TotalAmount, PaymentMethodId, StatusId, VoucherId, ReceiverName, ReceiverPhone, DeliveryAddress, Note) 
                 VALUES (?, ?, ?, 2, 1, ?, ?, ?, ?, ?)`,
                [orderCode, userId, totalAmount, voucherId || null,
                    receiverName.trim(), receiverPhone.trim(), deliveryAddress.trim(), note || '']
            );
            orderId = orderResult.insertId;

            // -- Insert chi tiet don hang --
            for (const item of cartItems) {
                await connection.execute(
                    `INSERT INTO OrderDetails (OrderId, FoodId, Quantity, UnitPrice, LineTotal) VALUES (?, ?, ?, ?, ?)`,
                    [orderId, item.FoodId, item.Quantity, item.BasePrice, item.Quantity * item.BasePrice]
                );
            }

            // -- Update stock --
            for (const item of cartItems) {
                await connection.execute(
                    `UPDATE Food SET Stock = GREATEST(0, Stock - ?) WHERE FoodId = ?`,
                    [item.Quantity, item.FoodId]
                );
            }
        }

        await connection.commit();

        // ============================================================
        // Tao URL thanh toan VNPay (dung thu vien chinh thuc)
        // ============================================================
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

        // Xay dung returnUrl dong tu request host (de dien thoai truy cap duoc)
        const reqHost = req.headers['host'] || `localhost:${process.env.PORT || 3000}`;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const returnUrl = `${protocol}://${reqHost}/api/vnpay/return`;

        const paymentUrl = vnpay.buildPaymentUrl({
            vnp_Amount: totalAmount,
            vnp_IpAddr: clientIp.replace('::ffff:', '').replace('::1', '127.0.0.1'),
            vnp_TxnRef: orderCode,
            vnp_OrderInfo: orderInfo || `Thanh toan don hang ${orderCode}`,
            vnp_ReturnUrl: returnUrl,
            vnp_Locale: VnpLocale.VN,
        });

        console.log(`VNPay URL created for order ${orderCode}, amount: ${totalAmount}`);
        console.log('Payment URL:', paymentUrl);

        res.json({
            paymentUrl,
            orderId,
            orderCode,
            totalAmount,
        });

    } catch (error) {
        await connection.rollback();
        console.error('CreatePaymentUrl error:', error.message);
        res.status(500).json({ message: 'Loi tao link thanh toan' });
    } finally {
        connection.release();
    }
};

// ============================================================
// 2) GET /api/vnpay/return
//    VNPay redirect user ve day sau khi thanh toan
// ============================================================
exports.vnpayReturn = async (req, res) => {
    try {
        const verify = vnpay.verifyReturnUrl(req.query);
        const txnRef = req.query['vnp_TxnRef'] || '';
        const responseCode = req.query['vnp_ResponseCode'] || '';

        console.log('VNPay return verify:', { isVerified: verify.isVerified, isSuccess: verify.isSuccess, message: verify.message });

        if (verify.isVerified && verify.isSuccess) {
            console.log(`VNPay payment SUCCESS for order ${txnRef}`);

            res.send(`
                <!DOCTYPE html>
                <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <title>Thanh toan thanh cong</title>
                <style>
                    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; 
                           min-height: 100vh; margin: 0; background: #0a0a0a; color: #fff; text-align: center; }
                    .container { padding: 40px 20px; }
                    h2 { color: #D4AF37; margin-bottom: 10px; }
                    p { color: #aaa; font-size: 14px; }
                </style></head>
                <body>
                    <div class="container">
                        <h2>Thanh toan thanh cong!</h2>
                        <p>Don hang <strong>${txnRef}</strong> da duoc thanh toan.</p>
                        <p>Dang chuyen huong ve ung dung...</p>
                    </div>
                </body></html>
            `);
        } else {
            console.log(`VNPay payment FAILED for order ${txnRef}, code: ${responseCode}`);

            // Cap nhat trang thai don hang -> cancelled
            try {
                await pool.execute(
                    `UPDATE Orders SET StatusId = 4 WHERE OrderCode = ?`,
                    [txnRef]
                );
            } catch (e) {
                console.error('Update order status error:', e.message);
            }

            res.send(`
                <!DOCTYPE html>
                <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <title>Thanh toan that bai</title>
                <style>
                    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; 
                           min-height: 100vh; margin: 0; background: #0a0a0a; color: #fff; text-align: center; }
                    .container { padding: 40px 20px; }
                    h2 { color: #E74C3C; margin-bottom: 10px; }
                    p { color: #aaa; font-size: 14px; }
                </style></head>
                <body>
                    <div class="container">
                        <h2>Thanh toan that bai</h2>
                        <p>Giao dich bi huy hoac co loi xay ra.</p>
                        <p>Dang chuyen huong ve ung dung...</p>
                    </div>
                </body></html>
            `);
        }
    } catch (error) {
        console.error('VNPay return error:', error.message);
        res.status(400).send(`
            <!DOCTYPE html>
            <html><head><meta charset="utf-8"><title>Loi</title>
            <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff;text-align:center;}</style></head>
            <body><div><h2 style="color:#E74C3C">Loi xac thuc</h2><p style="color:#aaa">Du lieu thanh toan khong hop le.</p></div></body></html>
        `);
    }
};

// ============================================================
// 3) GET /api/vnpay/ipn
//    VNPay server-to-server callback (Instant Payment Notification)
// ============================================================
exports.vnpayIPN = async (req, res) => {
    try {
        const verify = vnpay.verifyIpnCall(req.query);
        const txnRef = req.query['vnp_TxnRef'] || '';
        const responseCode = req.query['vnp_ResponseCode'] || '';

        if (!verify.isVerified) {
            return res.json({ RspCode: '97', Message: 'Invalid checksum' });
        }

        // Kiem tra don hang ton tai
        const [orders] = await pool.execute(
            `SELECT OrderId, TotalAmount, StatusId FROM Orders WHERE OrderCode = ?`,
            [txnRef]
        );

        if (orders.length === 0) {
            return res.json({ RspCode: '01', Message: 'Order not found' });
        }

        // Cap nhat trang thai
        if (verify.isSuccess) {
            console.log(`IPN: Payment confirmed for ${txnRef}`);
        } else {
            await pool.execute(
                `UPDATE Orders SET StatusId = 4 WHERE OrderCode = ?`,
                [txnRef]
            );
            console.log(`IPN: Payment failed for ${txnRef}, code: ${responseCode}`);
        }

        return res.json({ RspCode: '00', Message: 'Confirm Success' });

    } catch (error) {
        console.error('VNPay IPN error:', error.message);
        return res.json({ RspCode: '99', Message: 'Unknown error' });
    }
};
