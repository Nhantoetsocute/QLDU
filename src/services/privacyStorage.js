// No platform imports: the reset contract can be tested without native storage.
const listeners = new Set();
const LEGACY_PROFILE_KEYS = ['@user_profile', '@user_token', '@cart'];
const ACCOUNT_LOCAL_KEYS = [...LEGACY_PROFILE_KEYS, '@qldu_ai_consent'];

function subscribePrivacyReset(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function notifyPrivacyReset() {
  // Subscribers clear mounted state immediately and may return pending-write barriers.
  const tasks = [...listeners].map((listener) => {
    try { return Promise.resolve(listener()); } catch { return Promise.resolve(); }
  });
  await Promise.allSettled(tasks);
}

async function clearAccountLocalData(storage) {
  await notifyPrivacyReset();
  let keys = [];
  let enumerationFailed = false;
  try { keys = await storage.getAllKeys(); } catch { enumerationFailed = true; }
  const accountKeys = keys.filter((key) => key.startsWith('@cart:'));
  await storage.multiRemove([...new Set([...ACCOUNT_LOCAL_KEYS, ...accountKeys])]);
  if (enumerationFailed) throw new Error('Chưa thể kiểm tra hết dữ liệu của phiên cũ.');
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Hồ sơ không hợp lệ.');
  const id = Number(raw.id ?? raw.UserId);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Hồ sơ không hợp lệ.');
  const text = (value, max = 500) => typeof value === 'string' ? value.slice(0, max) : '';
  return {
    id,
    code: text(raw.code ?? raw.UserCode, 20),
    name: text(raw.name ?? raw.UserName ?? raw.userName, 120),
    email: text(raw.email ?? raw.Email, 190),
    phone: text(raw.phone ?? raw.Phone, 20),
    address: text(raw.address ?? raw.Address, 255),
    avatar: text(raw.avatar ?? raw.AvatarUrl ?? raw.avatarUri) || null,
  };
}

function normalizeCart(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).filter((item) => item && typeof item === 'object'
    && Number.isSafeInteger(Number(item.productId ?? item.id)) && Number(item.productId ?? item.id) > 0
    && typeof item.name === 'string' && Number.isFinite(Number(item.price)) && Number(item.price) >= 0
    && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99)
    .map((item) => ({
      id: String(item.id ?? item.productId),
      productId: Number(item.productId ?? item.id),
      name: item.name.slice(0, 200),
      price: Number(item.price),
      quantity: item.quantity,
      image: typeof item.image === 'string' || typeof item.image === 'number' ? item.image : null,
    }));
}

module.exports = {
  LEGACY_PROFILE_KEYS,
  subscribePrivacyReset,
  notifyPrivacyReset,
  clearAccountLocalData,
  normalizeProfile,
  normalizeCart,
};
