const security = require('../services/orderSecurityService');
const { getReturnUrl } = require('../security/transport');
const { escapeHtml } = require('../security/output');
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
exports.createPaymentUrl = async (req, res, next) => {
    try {
        const result = await security.transaction(pool, async connection => {
            const order = await security.createOrder(connection, req.user.userId, req.body);
            const returnUrl=getReturnUrl(req);
            const paymentUrl = vnpay.buildPaymentUrl({
                vnp_Amount:order.totalAmount, vnp_IpAddr:req.ip.replace('::ffff:', '').replace('::1','127.0.0.1'),
                vnp_TxnRef:order.orderCode, vnp_OrderInfo:req.body.orderInfo || `Thanh toan don hang ${order.orderCode}`,
                vnp_ReturnUrl: returnUrl, vnp_Locale:VnpLocale.VN,
            });
            return {...order,paymentUrl,returnUrl};
        });
        res.json(result);
    } catch(error) { next(error); }
};

// ============================================================
// 2) GET /api/vnpay/return
//    VNPay redirect user ve day sau khi thanh toan
// ============================================================
// Browser redirects display a result only. Only the signed IPN changes payment state.
exports.vnpayReturn = async (req, res) => {
    try {
        const verify = vnpay.verifyReturnUrl(req.query);
        if (!verify.isVerified || req.query.vnp_TmnCode !== process.env.VNP_TMN_CODE) return res.status(400).send('Dữ liệu thanh toán không hợp lệ.');
        const [orders] = await pool.execute(`SELECT o.TotalAmount, pt.State FROM Orders o JOIN PaymentTransactions pt ON pt.OrderId = o.OrderId WHERE o.OrderCode = ? AND o.PaymentMethodId = 2`,[req.query.vnp_TxnRef]);
        if (!orders[0] || security.cents(orders[0].TotalAmount) !== BigInt(req.query.vnp_Amount)) return res.status(400).send('Dữ liệu thanh toán không hợp lệ.');
        const message = orders[0].State === 'paid' ? 'Thanh toán thành công.' : orders[0].State === 'failed' ? 'Thanh toán không thành công.' : 'Đang chờ VNPay xác nhận thanh toán.';
        res.type('html').send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Thanh toán</title></head><body><h2>${message}</h2><p>Đơn hàng: ${escapeHtml(req.query.vnp_TxnRef)}</p><p>Vui lòng quay lại ứng dụng để kiểm tra trạng thái.</p></body></html>`);
    } catch { res.status(400).send('Không thể xác thực thanh toán.'); }
};
exports.vnpayIPN = async (req, res) => {
    try {
        const verify = vnpay.verifyIpnCall(req.query);
        if (!verify.isVerified || req.query.vnp_TmnCode !== process.env.VNP_TMN_CODE) return res.json({RspCode:'97',Message:'Invalid checksum'});
        const result = await security.transaction(pool, c => security.confirmPayment(c, req.query, verify, process.env.VNP_TMN_CODE));
        return res.json(result);
    } catch { return res.json({RspCode:'99',Message:'Unknown error'}); }
};
