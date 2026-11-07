const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clearAccountLocalData, normalizeProfile, normalizeCart, subscribePrivacyReset,
} = require('../src/services/privacyStorage');

function storageWith(values) {
  const store = new Map(Object.entries(values));
  return {
    store,
    getAllKeys: async () => [...store.keys()],
    multiRemove: async (keys) => { for (const key of keys) store.delete(key); },
  };
}

test('account cleanup removes cached identity, every account cart and AI consent while preserving device preferences', async () => {
  const storage = storageWith({
    '@user_profile': '{"email":"old@example.test"}', '@user_token': 'legacy-token',
    '@cart': 'legacy-cart', '@cart:1': 'first-cart', '@cart:2': 'second-cart',
    '@qldu_ai_consent': 'accepted', '@selected_language': 'vi',
    '@notification_settings': '{"promotions":false}', 'theme': 'dark',
  });
  await clearAccountLocalData(storage);
  assert.deepEqual([...storage.store.keys()].sort(), ['@notification_settings', '@selected_language', 'theme']);
});

test('cleanup waits for mounted contexts to finish prior writes before removing their data', async () => {
  const storage = storageWith({ '@cart:1': 'old-cart' });
  let finishWrite;
  let contextCleared = false;
  const unsubscribe = subscribePrivacyReset(() => {
    contextCleared = true;
    return new Promise((resolve) => { finishWrite = () => { storage.store.set('@cart:1', 'last-write'); resolve(); }; });
  });
  try {
    const clearing = clearAccountLocalData(storage);
    assert.equal(contextCleared, true);
    assert.equal(storage.store.has('@cart:1'), true);
    finishWrite();
    await clearing;
    assert.equal(storage.store.has('@cart:1'), false);
  } finally { unsubscribe(); }
});

test('one failing reset subscriber does not prevent others or disk cleanup', async () => {
  const storage = storageWith({ '@user_profile': 'old-profile' });
  const unsubscribeBad = subscribePrivacyReset(() => { throw new Error('component already gone'); });
  let cleared = false;
  const unsubscribeGood = subscribePrivacyReset(() => { cleared = true; });
  try {
    await clearAccountLocalData(storage);
    assert.equal(cleared, true);
    assert.equal(storage.store.size, 0);
  } finally { unsubscribeBad(); unsubscribeGood(); }
});

test('profiles normalize API identity and retain only explicit display fields', () => {
  const profile = normalizeProfile({ UserId: '7', UserCode: 'USR7', name: 'Test', email: 'test@example.test', phone: '0901234567', address: 'Address', avatar: '/avatars/1.webp', PasswordHash: 'must-not-retain', OTPCode: '123456', role: 'admin' });
  assert.equal(profile.id, 7);
  assert.equal(profile.code, 'USR7');
  for (const key of ['PasswordHash', 'OTPCode', 'role']) assert.equal(key in profile, false);
  for (const invalid of [null, [], {}, { id: -1 }, { id: 'unexpected' }]) assert.throws(() => normalizeProfile(invalid));
});

test('cart cache contains product data only and rejects malformed products', () => {
  const cart = normalizeCart([
    { id: '1', name: 'Drink', price: '25000', quantity: 2, image: 'https://example.test/a.webp', email: 'must-not-retain@example.test', address: 'must-not-retain' },
    { id: '2', name: 'Invalid quantity', price: 1, quantity: -2 },
    { id: 'invalid', name: 'Invalid ID', price: 1, quantity: 1 },
  ]);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].productId, 1);
  assert.equal(cart[0].price, 25000);
  assert.equal('email' in cart[0], false);
  assert.equal('address' in cart[0], false);
});


test('cleanup still removes known personal keys if enumerating scoped caches fails', async () => {
  const removed = [];
  await assert.rejects(clearAccountLocalData({
    getAllKeys: async () => { throw new Error('storage enumeration unavailable'); },
    multiRemove: async (keys) => removed.push(...keys),
  }));
  assert.ok(removed.includes('@user_profile'));
  assert.ok(removed.includes('@qldu_ai_consent'));
  assert.equal(removed.includes('@notification_settings'), false);
});
