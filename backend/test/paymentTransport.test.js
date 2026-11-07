const test = require('node:test');
const assert = require('node:assert/strict');
const { paymentDetails, isPaymentNavigationAllowed, isPaymentReturn } = require('../../src/config/paymentTransport');
const options = { apiBase: 'https://api.example.com' };
const details = { paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=ORDTEST', returnUrl: 'https://api.example.com/api/vnpay/return', orderId: 12, orderCode: 'ORDTEST' };

test('payment URL accepts official HTTPS sandbox/production gateways and canonicalizes order identity', () => {
  assert.equal(paymentDetails(details, options).id, 12);
  const live = paymentDetails({ ...details, orderId: '12', paymentUrl: 'https://pay.vnpay.vn/vpcpay.html?vnp_TxnRef=ORDTEST' }, options);
  assert.equal(live.id, 12); assert.match(live.paymentUrl, /^https:\/\/pay.vnpay.vn\//);
});
test('initial gateway URLs reject cleartext, lookalike hosts, userinfo, arbitrary ports and fragments', () => {
  for (const url of [
    'http://sandbox.vnpayment.vn/payment', 'https://sandbox.vnpayment.vn.attacker.example/pay',
    'https://sandbox.vnpayment.vn@attacker.example/pay', 'https://user:password@sandbox.vnpayment.vn/pay',
    'https://sandbox.vnpayment.vn:444/pay', 'https://sandbox.vnpayment.vn/pay#injected',
    'javascript:alert(1)', 'https://sandbox.vnpayment.vn\\@attacker.example',
  ]) assert.throws(() => paymentDetails({ ...details, paymentUrl: url }, options));
});
test('return URL must match configured API origin and exact callback path without credentials, query or fragment', () => {
  for (const url of [
    'https://attacker.example/api/vnpay/return', 'http://api.example.com/api/vnpay/return',
    'https://api.example.com:444/api/vnpay/return', 'https://api.example.com/other',
    'https://user:pass@api.example.com/api/vnpay/return',
    'https://api.example.com/api/vnpay/return?key=value', 'https://api.example.com/api/vnpay/return#fragment',
  ]) assert.throws(() => paymentDetails({ ...details, returnUrl: url }, options));
});
test('payment identities cannot inject paths or unsafe numbers into the verification API', () => {
  for (const id of [-1, 0, 1.5, true, '12/../another', 1e20]) assert.throws(() => paymentDetails({ ...details, orderId: id }, options));
  for (const code of ['<script>', 'ORD../1', 'ORD?token=x', 'x'.repeat(31)]) assert.throws(() => paymentDetails({ ...details, orderCode: code }, options));
});
test('local HTTP callbacks are permitted only during development for the configured API origin', () => {
  const dev = { apiBase: 'http://192.168.1.10:3000', development: true };
  const payment = paymentDetails({ ...details, returnUrl: dev.apiBase + '/api/vnpay/return' }, dev);
  assert.equal(isPaymentNavigationAllowed(dev.apiBase + '/api/vnpay/return?vnp_TxnRef=ORDTEST', payment, dev), true);
  assert.equal(isPaymentNavigationAllowed('http://192.168.1.11:3000/api/vnpay/return', payment, dev), false);
  assert.equal(isPaymentNavigationAllowed(dev.apiBase + '/api/user/profile', payment, dev), false);
  assert.throws(() => paymentDetails({ ...details, returnUrl: payment.returnUrl }, { apiBase: dev.apiBase }));
});
test('navigation supports HTTPS bank pages and rejects arbitrary external schemes and insecure downgrades', () => {
  const payment = paymentDetails(details, options);
  assert.equal(isPaymentNavigationAllowed('https://secure.bank.example/auth?session=1', payment, options), true);
  assert.equal(isPaymentNavigationAllowed('about:blank', payment, options), true);
  for (const url of ['http://secure.bank.example/auth', 'http://api.example.com/api/vnpay/return', 'javascript:alert(1)', 'data:text/html,test', 'file:///private/data', 'intent://pay', 'https://user:pass@bank.example/auth']) {
    assert.equal(isPaymentNavigationAllowed(url, payment, options), false);
  }
});
test('return matching requires exact origin, path and one expected transaction reference', () => {
  const payment = paymentDetails(details, options);
  assert.equal(isPaymentReturn(details.returnUrl + '?vnp_TxnRef=ORDTEST&vnp_ResponseCode=00', payment), true);
  for (const url of [
    'https://attacker.example/api/vnpay/return?vnp_TxnRef=ORDTEST',
    details.returnUrl + '?vnp_TxnRef=ANOTHER', details.returnUrl + '?vnp_TxnRef=ORDTEST&vnp_TxnRef=ANOTHER',
    details.returnUrl + '?vnp_TxnRef=ORDTEST#fragment', details.returnUrl.replace('/return','/other') + '?vnp_TxnRef=ORDTEST',
    'https://user:pass@api.example.com/api/vnpay/return?vnp_TxnRef=ORDTEST',
  ]) assert.equal(isPaymentReturn(url, payment), false);
});
