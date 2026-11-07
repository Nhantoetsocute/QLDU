const { apiOrigin } = require('./transport');
const gatewayHosts = new Set(['sandbox.vnpayment.vn', 'pay.vnpay.vn']);

function parsePaymentUrl(value) {
  if (typeof value !== 'string' || !value || /[\s\\]/.test(value)) throw new Error('URL thanh toán không hợp lệ.');
  let url;
  try { url = new URL(value); } catch { throw new Error('URL thanh toán không hợp lệ.'); }
  if (url.username || url.password) throw new Error('URL thanh toán không được chứa thông tin đăng nhập.');
  return url;
}
function paymentDetails(data, { apiBase, development = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Thông tin thanh toán không hợp lệ.');
  const api = apiOrigin(apiBase, { development });
  const gateway = parsePaymentUrl(data.paymentUrl);
  if (gateway.protocol !== 'https:' || !gatewayHosts.has(gateway.hostname) || gateway.port || gateway.hash) throw new Error('Cổng thanh toán phải dùng địa chỉ HTTPS chính thức của VNPay.');
  const callback = parsePaymentUrl(data.returnUrl);
  if (callback.origin !== api || callback.pathname !== '/api/vnpay/return' || callback.search || callback.hash) throw new Error('Địa chỉ trở về phải thuộc API đã cấu hình.');
  if (!development && callback.protocol !== 'https:') throw new Error('Địa chỉ trở về phải dùng HTTPS.');
  const id = typeof data.orderId === 'string' && /^[1-9]\d{0,14}$/.test(data.orderId) ? Number(data.orderId) : data.orderId;
  if (!Number.isSafeInteger(id) || id < 1 || typeof data.orderCode !== 'string' || !/^[A-Z0-9-]{1,30}$/.test(data.orderCode)) throw new Error('Mã đơn thanh toán không hợp lệ.');
  return { id, code: data.orderCode, paymentUrl: gateway.href, returnUrl: callback.href };
}
function isPaymentNavigationAllowed(value, payment, { apiBase, development = false } = {}) {
  if (value === 'about:blank') return true;
  try {
    if (!payment) return false;
    const target = parsePaymentUrl(value);
    if (target.protocol === 'https:') return true; // Bank authentication may use a different HTTPS origin.
    if (!development || target.protocol !== 'http:') return false;
    const api = apiOrigin(apiBase, { development });
    const callback = parsePaymentUrl(payment.returnUrl);
    return target.origin === api && target.origin === callback.origin && target.pathname === callback.pathname;
  } catch { return false; }
}
function isPaymentReturn(value, payment) {
  try {
    if (!payment) return false;
    const target = parsePaymentUrl(value);
    const callback = parsePaymentUrl(payment.returnUrl);
    const references = target.searchParams.getAll('vnp_TxnRef');
    return !target.hash && target.origin === callback.origin && target.pathname === callback.pathname
      && references.length === 1 && references[0] === payment.code;
  } catch { return false; }
}
module.exports = { paymentDetails, isPaymentNavigationAllowed, isPaymentReturn };
