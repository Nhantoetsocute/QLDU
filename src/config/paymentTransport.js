const { apiOrigin } = require('./transport');
const SEPAY_PATH = '/api/sepay/';

function parsePaymentUrl(value) {
  if (typeof value !== 'string' || !value || /[\s\\]/.test(value)) throw new Error('URL thanh toán không hợp lệ.');
  let url;
  try { url = new URL(value); } catch { throw new Error('URL thanh toán không hợp lệ.'); }
  if (url.username || url.password) throw new Error('URL thanh toán không được chứa thông tin đăng nhập.');
  return url;
}
// paymentUrl is our own checkout page (/api/sepay/checkout/<code>) which POSTs the signed form to SePay.
function paymentDetails(data, { apiBase, development = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Thông tin thanh toán không hợp lệ.');
  const api = apiOrigin(apiBase, { development });
  const id = typeof data.orderId === 'string' && /^[1-9]\d{0,14}$/.test(data.orderId) ? Number(data.orderId) : data.orderId;
  if (!Number.isSafeInteger(id) || id < 1 || typeof data.orderCode !== 'string' || !/^[A-Z0-9-]{1,40}$/.test(data.orderCode)) throw new Error('Mã đơn thanh toán không hợp lệ.');
  const checkout = parsePaymentUrl(data.paymentUrl);
  if (checkout.origin !== api || checkout.pathname !== `${SEPAY_PATH}checkout/${data.orderCode}` || checkout.search || checkout.hash) throw new Error('Trang thanh toán phải thuộc API đã cấu hình.');
  const callback = parsePaymentUrl(data.returnUrl);
  if (callback.origin !== api || callback.pathname !== `${SEPAY_PATH}return` || callback.search || callback.hash) throw new Error('Địa chỉ trở về phải thuộc API đã cấu hình.');
  if (!development && callback.protocol !== 'https:') throw new Error('Địa chỉ trở về phải dùng HTTPS.');
  return { id, code: data.orderCode, paymentUrl: checkout.href, returnUrl: callback.href };
}
function isPaymentNavigationAllowed(value, payment, { apiBase, development = false } = {}) {
  if (value === 'about:blank') return true;
  try {
    if (!payment) return false;
    const target = parsePaymentUrl(value);
    if (target.protocol === 'https:') return true; // SePay and bank authentication pages use other HTTPS origins.
    if (!development || target.protocol !== 'http:') return false;
    const api = apiOrigin(apiBase, { development });
    return target.origin === api && [new URL(payment.paymentUrl).pathname, new URL(payment.returnUrl).pathname].includes(target.pathname);
  } catch { return false; }
}
function isPaymentReturn(value, payment) {
  try {
    if (!payment) return false;
    const target = parsePaymentUrl(value);
    const callback = parsePaymentUrl(payment.returnUrl);
    const references = target.searchParams.getAll('order');
    return !target.hash && target.origin === callback.origin && target.pathname === callback.pathname
      && references.length === 1 && references[0] === payment.code;
  } catch { return false; }
}
module.exports = { paymentDetails, isPaymentNavigationAllowed, isPaymentReturn };
