// Shared pure helpers; kept independent of React Native so transport rules can be tested in Node.
const localHost = (hostname) => {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const parts = host.split('.');
  const ipv4 = parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  return host === 'localhost' || host === '::1'
    || (ipv4 && /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host));
};
function apiOrigin(value, { development = false } = {}) {
  if (typeof value !== 'string' || !value || /[\s\\]/.test(value)) throw new Error('URL API không hợp lệ.');
  let url;
  try { url = new URL(value); } catch { throw new Error('URL API không hợp lệ.'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('URL API chỉ được chứa origin, không có thông tin đăng nhập, đường dẫn, query hoặc fragment.');
  if (url.protocol !== 'https:' && !(development && url.protocol === 'http:' && localHost(url.hostname))) {
    throw new Error('API yêu cầu HTTPS; HTTP chỉ dùng cho địa chỉ cục bộ khi phát triển.');
  }
  return url.origin;
}
function apiPath(origin, path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x20\x7f]/.test(path) || path.includes('#')) throw new Error('Đường dẫn API không hợp lệ.');
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error('Không được gửi dữ liệu sang origin khác.');
  return url.href;
}
module.exports = { apiOrigin, apiPath, localHost };
