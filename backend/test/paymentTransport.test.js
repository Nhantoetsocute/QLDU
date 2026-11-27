const test = require('node:test');
const assert = require('node:assert/strict');
const { paymentDetails, isPaymentNavigationAllowed, isPaymentReturn } = require('../../src/config/paymentTransport');
const options = { apiBase: 'https://api.example.com' };
const details = { paymentUrl: 'https://api.example.com/api/sepay/checkout/ORDTEST', returnUrl: 'https://api.example.com/api/sepay/return', orderId: 12, orderCode: 'ORDTEST' };

test('payment URL must be our own checkout page for this order and canonicalizes order identity', () => {
  assert.equal(paymentDetails(details, options).id, 12);
  assert.equal(paymentDetails({ ...details, orderId: '12' }, options).id, 12);
});
test('checkout URLs reject other origins, other orders, cleartext, userinfo, query and fragments', () => {
  for (const url of [
    'http://api.example.com/api/sepay/checkout/ORDTEST', 'https://attacker.example/api/sepay/checkout/ORDTEST',
    'https://api.example.com/api/sepay/checkout/OTHER', 'https://user:pass@api.example.com/api/sepay/checkout/ORDTEST',
    'https://api.example.com/api/sepay/checkout/ORDTEST?x=1', 'https://api.example.com/api/sepay/checkout/ORDTEST#x',
    'https://pay.sepay.vn/v1/checkout/init', 'javascript:alert(1)',
  ]) assert.throws(() => paymentDetails({ ...details, paymentUrl: url }, options));
});
test('return URL must match configured API origin and exact callback path without credentials, query or fragment', () => {
  for (const url of [
    'https://attacker.example/api/sepay/return', 'http://api.example.com/api/sepay/return',
    'https://api.example.com:444/api/sepay/return', 'https://api.example.com/other',
    'https://user:pass@api.example.com/api/sepay/return',
    'https://api.example.com/api/sepay/return?key=value', 'https://api.example.com/api/sepay/return#fragment',
  ]) assert.throws(() => paymentDetails({ ...details, returnUrl: url }, options));
});
test('payment identities cannot inject paths or unsafe numbers into the verification API', () => {
  for (const id of [-1, 0, 1.5, true, '12/../another', 1e20]) assert.throws(() => paymentDetails({ ...details, orderId: id }, options));
  for (const code of ['<script>', 'ORD../1', 'ORD?token=x', 'x'.repeat(41)]) assert.throws(() => paymentDetails({ ...details, orderCode: code }, options));
});
test('local HTTP pages are permitted only during development for the configured API origin', () => {
  const dev = { apiBase: 'http://192.168.1.10:3000', development: true };
  const payment = paymentDetails({ ...details, paymentUrl: dev.apiBase + '/api/sepay/checkout/ORDTEST', returnUrl: dev.apiBase + '/api/sepay/return' }, dev);
  assert.equal(isPaymentNavigationAllowed(dev.apiBase + '/api/sepay/checkout/ORDTEST', payment, dev), true);
  assert.equal(isPaymentNavigationAllowed(dev.apiBase + '/api/sepay/return?order=ORDTEST', payment, dev), true);
  assert.equal(isPaymentNavigationAllowed('http://192.168.1.11:3000/api/sepay/return', payment, dev), false);
  assert.equal(isPaymentNavigationAllowed(dev.apiBase + '/api/user/profile', payment, dev), false);
  assert.throws(() => paymentDetails({ ...details, returnUrl: payment.returnUrl }, { apiBase: dev.apiBase }));
});
test('navigation supports HTTPS gateway/bank pages and rejects arbitrary external schemes and insecure downgrades', () => {
  const payment = paymentDetails(details, options);
  assert.equal(isPaymentNavigationAllowed('https://pay-sandbox.sepay.vn/v1/checkout/init', payment, options), true);
  assert.equal(isPaymentNavigationAllowed('about:blank', payment, options), true);
  for (const url of ['http://secure.bank.example/auth', 'http://api.example.com/api/sepay/return', 'javascript:alert(1)', 'data:text/html,test', 'file:///private/data', 'intent://pay', 'https://user:pass@bank.example/auth']) {
    assert.equal(isPaymentNavigationAllowed(url, payment, options), false);
  }
});
test('return matching requires exact origin, path and one expected order reference', () => {
  const payment = paymentDetails(details, options);
  assert.equal(isPaymentReturn(details.returnUrl + '?order=ORDTEST&t=abc&r=success', payment), true);
  for (const url of [
    'https://attacker.example/api/sepay/return?order=ORDTEST',
    details.returnUrl + '?order=ANOTHER', details.returnUrl + '?order=ORDTEST&order=ANOTHER',
    details.returnUrl + '?order=ORDTEST#fragment', details.returnUrl.replace('/return','/other') + '?order=ORDTEST',
    'https://user:pass@api.example.com/api/sepay/return?order=ORDTEST',
  ]) assert.equal(isPaymentReturn(url, payment), false);
});
