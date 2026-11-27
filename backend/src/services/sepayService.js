// SePay payment gateway — same flow as the WEB-PHP project (includes/sepay.php):
// app opens our checkout page → browser POSTs a signed form to SePay → SePay redirects to success/error/cancel_url
// → SePay calls the IPN (POST JSON, header X-Secret-Key). Only the IPN marks an order as paid.
// Env: SEPAY_ENV (sandbox|production), SEPAY_MERCHANT_ID, SEPAY_SECRET_KEY (form signing), SEPAY_IPN_SECRET (X-Secret-Key).
const { createHmac, timingSafeEqual } = require('node:crypto');

const CHECKOUT_URLS = {
    sandbox: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
    production: 'https://pay.sepay.vn/v1/checkout/init',
};

function config(env = process.env) {
    return {
        env: String(env.SEPAY_ENV || 'sandbox').trim().toLowerCase(),
        merchant: String(env.SEPAY_MERCHANT_ID || '').trim(),
        secret: String(env.SEPAY_SECRET_KEY || '').trim(),
        ipn: String(env.SEPAY_IPN_SECRET || '').trim(),
    };
}
function isConfigured(env = process.env) {
    const c = config(env);
    return Object.hasOwn(CHECKOUT_URLS, c.env) && /^SP-[A-Z0-9-]{4,40}$/.test(c.merchant) && c.secret.length >= 16 && c.ipn.length >= 16;
}
function checkoutUrl(env = process.env) {
    const c = config(env);
    if (!Object.hasOwn(CHECKOUT_URLS, c.env)) throw new Error('SEPAY_ENV phải là sandbox hoặc production.');
    return CHECKOUT_URLS[c.env];
}
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Signature as in sepay-pg SDK: HMAC-SHA256 over "k=v,k=v,..." in field order, base64 of the binary digest.
function sign(fields, env = process.env) {
    return createHmac('sha256', config(env).secret).update(Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(',')).digest('base64');
}
// Unforgeable per-order token on the return URL, so a forged cancel link cannot cancel someone's pending order.
function returnToken(orderCode, env = process.env) {
    return createHmac('sha256', config(env).secret).update(`return:${orderCode}`).digest('hex');
}
const validReturnToken = (orderCode, token, env = process.env) => safeEqual(returnToken(orderCode, env), token);

// SePay only accepts integer VND; createOrder rejects fractional totals for gateway orders.
function formFields(order, returnUrl, env = process.env) {
    const back = `${returnUrl}?order=${encodeURIComponent(order.orderCode)}&t=${returnToken(order.orderCode, env)}&r=`;
    const fields = {
        merchant: config(env).merchant,
        currency: 'VND',
        order_amount: String(Math.round(Number(order.totalAmount))),
        operation: 'PURCHASE',
        order_description: `Thanh toan don hang ${order.orderCode}`,
        order_invoice_number: order.orderCode,
        success_url: back + 'success',
        error_url: back + 'error',
        cancel_url: back + 'cancel',
    };
    fields.signature = sign(fields, env);
    return fields;
}
// IPN is valid only with the right X-Secret-Key header (Auth Type = SECRET_KEY in the SePay IPN tab).
const verifyIpn = (secretHeader, env = process.env) => isConfigured(env) && safeEqual(config(env).ipn, secretHeader);

module.exports = { CHECKOUT_URLS, config, isConfigured, checkoutUrl, sign, returnToken, validReturnToken, formFields, verifyIpn };
