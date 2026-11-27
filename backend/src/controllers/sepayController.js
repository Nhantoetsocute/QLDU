const { randomBytes } = require('node:crypto');
const security = require('../services/orderSecurityService');
const sepay = require('../services/sepayService');
const { getReturnUrl } = require('../security/transport');
const { escapeHtml } = require('../security/output');
const pool = require('../config/db');

const page = (res, title, body, csp) => {
    if (csp) res.set('Content-Security-Policy', csp);
    res.type('html').send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body>${body}</body></html>`);
};
const unavailable = res => res.status(503).json({ error: 'Thanh toán SePay tạm thời không khả dụng. Vui lòng chọn phương thức khác.' });

// POST /api/sepay/create-payment — create the pending order; the app opens paymentUrl (our checkout page) in a WebView.
exports.createPayment = async (req, res, next) => {
    try {
        if (!sepay.isConfigured()) return unavailable(res);
        const returnUrl = getReturnUrl(req);
        const order = await security.transaction(pool, c => security.createOrder(c, req.user.userId, req.body));
        const paymentUrl = returnUrl.replace(/\/return$/, `/checkout/${order.orderCode}`);
        res.json({ ...order, paymentUrl, returnUrl });
    } catch (error) { next(error); }
};

// GET /api/sepay/checkout/:orderCode — auto-submits the signed form to SePay (it only accepts POST).
exports.checkout = async (req, res) => {
    try {
        if (!sepay.isConfigured()) return unavailable(res);
        const [rows] = await pool.execute(`SELECT o.OrderCode, o.TotalAmount FROM Orders o JOIN PaymentTransactions pt ON pt.OrderId = o.OrderId
            WHERE o.OrderCode = ? AND o.PaymentMethodId = 2 AND o.StatusId = 1 AND pt.State = 'pending'`, [req.params.orderCode]);
        if (!rows[0]) return res.status(404).send('Đơn hàng không còn chờ thanh toán.');
        const action = sepay.checkoutUrl();
        const fields = sepay.formFields({ orderCode: rows[0].OrderCode, totalAmount: rows[0].TotalAmount }, getReturnUrl(req));
        const nonce = randomBytes(16).toString('base64');
        const inputs = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`).join('');
        page(res, 'Đang chuyển sang SePay',
            `<p>Đang chuyển sang cổng thanh toán SePay…</p><form id="f" method="post" action="${escapeHtml(action)}">${inputs}<button type="submit">Tiếp tục thanh toán</button></form><script nonce="${nonce}">document.getElementById('f').submit()</script>`,
            `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${new URL(action).origin}; frame-ancestors 'none'; base-uri 'none'`);
    } catch { res.status(500).send('Không thể mở cổng thanh toán.'); }
};

// GET /api/sepay/return — unsigned browser redirect: may only CANCEL this order (valid token), never mark it paid.
exports.sepayReturn = async (req, res) => {
    try {
        const { order: code, r, t } = req.query;
        if (!sepay.isConfigured() || !sepay.validReturnToken(code, t)) return res.status(400).send('Dữ liệu thanh toán không hợp lệ.');
        if (r === 'cancel' || r === 'error') await security.transaction(pool, c => security.cancelPendingPayment(c, code));
        const [rows] = await pool.execute('SELECT pt.State FROM Orders o JOIN PaymentTransactions pt ON pt.OrderId = o.OrderId WHERE o.OrderCode = ? AND o.PaymentMethodId = 2', [code]);
        if (!rows[0]) return res.status(400).send('Dữ liệu thanh toán không hợp lệ.');
        const message = rows[0].State === 'paid' ? 'Thanh toán thành công.' : rows[0].State === 'failed' ? 'Thanh toán không thành công. Đơn hàng đã được hủy.' : 'Đang chờ SePay xác nhận thanh toán.';
        page(res, 'Thanh toán', `<h2>${message}</h2><p>Đơn hàng: ${escapeHtml(code)}</p><p>Vui lòng quay lại ứng dụng để kiểm tra trạng thái.</p>`);
    } catch { res.status(400).send('Không thể xác thực thanh toán.'); }
};

// POST /api/sepay/ipn — server-to-server, authenticated by the X-Secret-Key header.
exports.sepayIpn = async (req, res) => {
    if (!sepay.isConfigured()) return res.status(503).json({ success: false });
    if (!sepay.verifyIpn(req.get('x-secret-key'))) return res.status(401).json({ success: false });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ success: false });
    try {
        const result = await security.transaction(pool, c => security.handleSepayIpn(c, req.body));
        const invoice = String(req.body.order?.order_invoice_number ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
        console.log(`SEPAY_IPN: invoice=${invoice} result=${result}`);
        // Processed (mismatch/unknown/late are logged for admins): acknowledge so SePay stops retrying.
        res.json({ success: true });
    } catch { res.status(500).json({ success: false }); }
};
