const { ChatError } = require('./chatErrors');

const OUT_OF_SCOPE_REPLY = 'Xin lỗi bạn, mình là trợ lý AI của True Juice, hiện tại mình chỉ hỗ trợ tư vấn sản phẩm và thông tin cửa hàng thôi ạ. Bạn muốn mình gợi ý một món đồ uống ngon không?';
const WELCOME_REPLY = 'Xin chào! Mình là trợ lý AI của True Juice. Mình có thể giúp bạn tìm đồ uống yêu thích, tư vấn sản phẩm hoặc cung cấp thông tin cửa hàng. Hôm nay bạn muốn uống gì ạ?';
const NO_MATCH_REPLY = 'Mình chưa tìm thấy sản phẩm phù hợp trong danh mục hiện tại của True Juice. Bạn thử đổi tên món, danh mục hoặc ngân sách nhé.';
const UNKNOWN_REPLY = 'Mình chưa có dữ liệu được xác minh về thông tin bạn hỏi nên chưa thể khẳng định. Mình có thể hỗ trợ tra giá, mô tả sản phẩm, địa chỉ và giờ hoạt động đã công bố của True Juice.';
const INTENTS = new Set(['greeting', 'social', 'clarify', 'recommend', 'search', 'compare', 'product_info', 'stores', 'no_match', 'unknown_information']);
const FIELDS = new Set(['price', 'description', 'ingredients', 'stock', 'address', 'hours', 'phone', 'amenities']);

const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const currency = (value) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
const isProductIntent = (intent) => ['recommend', 'search', 'compare', 'product_info'].includes(intent);

function blockedMessage(message) {
  const text = normalize(message);
  return /(bo qua|ignore|quen).{0,45}(quy tac|chi dan|huong dan|instructions|system|prompt)/.test(text)
    || /(dong vai|doi vai|thay doi vai tro|system prompt|developer message|jailbreak|reveal.*prompt)/.test(text)
    || /\b(python|javascript|lap trinh|chinh tri|bong da|thoi tiet|chung khoan|bitcoin|tong thong|thu tuong)\b/.test(text)
    || /(?:hay|giup toi|toi muon)\s+(?:dat hang|thanh toan|huy don)\b/.test(text);
}

function extractBudget(message) {
  const text = normalize(message);
  const match = text.match(/(duoi|nho hon|re hon|khong qua|toi da|ngan sach|toi dang co|dang co|toi co)\s*(\d[\d.,]*)(?:\s*(nghin|ngan|k|trieu))?/);
  if (!match) return null;
  const raw = match[2];
  const isGrouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw);
  let amount = Number(isGrouped ? raw.replace(/[.,]/g, '') : raw.replace(',', '.'));
  if (['nghin', 'ngan', 'k'].includes(match[3])) amount *= 1000;
  if (match[3] === 'trieu') amount *= 1000000;
  if (!Number.isFinite(amount) || amount < 0) return null;
  return { max: amount, exclusive: ['duoi', 'nho hon', 're hon'].includes(match[1]) };
}

function conversationBudget(message, history) {
  const text = normalize(message);
  if (/khong gioi han|bat ke gia|khong quan tam gia/.test(text)) return null;
  const current = extractBudget(message);
  if (current) return current;
  // Keep the shopper's most recent budget for follow-ups, not assistant claims.
  for (const item of [...history].reverse()) {
    if (item.role !== 'user') continue;
    if (/khong gioi han|bat ke gia|khong quan tam gia/.test(normalize(item.content))) return null;
    const previous = extractBudget(item.content);
    if (previous) return previous;
  }
  return null;
}

function explicitProductSearch(message, products) {
  const text = normalize(message).replace(/[?.!]+$/g, '').trim();
  const match = text.match(/(?:^|\s)co\s+(?:ban\s+)?(.+?)\s+(?:khong|ko|khong a)$/)
    || text.match(/^(?:tim|tim kiem|gia cua|thong tin ve|thanh phan cua)\s+(.+)$/);
  if (!match) return null;
  const query = match[1].replace(/^(?:mon|san pham|do uong)\s+/, '').replace(/\s+(?:khong|la bao nhieu|bao nhieu tien)$/, '').trim();
  if (query.length < 3 || /\b(nao|gi|duoi|tren|ngan sach|so sanh|gia|re|ngon|khuyen mai|ban|cho|wifi|dau|loai|khong duong|it duong|it ngot)\b/.test(query)) return null;
  return products.filter((product) => normalize(product.name).includes(query) || normalize(product.categoryName).includes(query));
}

function containsSensitiveCredentials(message) {
  return /(?:mat khau|password|api.?key|access.?token)\s*(?:cua toi|cua minh|la|is|:|=)/i.test(normalize(message))
    || /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(message)
    || /AIza[A-Za-z0-9_-]{20,}/.test(message);
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)
    || Object.keys(plan).some((key) => !['scope', 'intent', 'productIds', 'storeIds', 'fields', 'response'].includes(key))
    || !['in_scope', 'out_of_scope'].includes(plan.scope) || !INTENTS.has(plan.intent)
    || !Array.isArray(plan.productIds) || plan.productIds.length > 4 || !plan.productIds.every(Number.isSafeInteger)
    || !Array.isArray(plan.storeIds) || plan.storeIds.length > 6 || !plan.storeIds.every((id) => typeof id === 'string' && id.length < 80)
    || !Array.isArray(plan.fields) || plan.fields.length > 8 || !plan.fields.every((field) => FIELDS.has(field))
    || typeof plan.response !== 'string' || plan.response.length > 500
    || (['social', 'clarify'].includes(plan.intent)
      ? (!plan.response.trim() || plan.productIds.length > 0 || plan.storeIds.length > 0)
      : Boolean(plan.response.trim()))) {
    throw new ChatError('GEMINI_INVALID_RESPONSE', 'Trợ lý AI trả về dữ liệu chưa hợp lệ. Bạn có thể bấm Thử lại.', 502);
  }
  return plan;
}

function isCheapestRequest(message) {
  return /\b(re nhat|gia re nhat|gia thap nhat|thap nhat)\b/.test(normalize(message));
}

function comparativePriceLimit(message, history, products) {
  if (!/\b(re hon|gia thap hon|it tien hon)\b/.test(normalize(message))) return null;
  const byName = (content) => products.filter((product) => normalize(content).includes(normalize(product.name)));
  const latestAssistantProducts = [...history].reverse()
    .filter((item) => item.role === 'assistant')
    .map((item) => byName(item.content))
    .find((matches) => matches.length > 0);
  if (!latestAssistantProducts) return null;
  return Math.min(...latestAssistantProducts.map((product) => product.price));
}

function productReply(plan, products, budget) {
  const lines = products.map((product) => {
    const details = [`${product.name} — ${currency(product.price)}`];
    if (plan.fields.includes('description') && product.description) details.push(product.description.slice(0, 400));
    if (plan.fields.includes('ingredients')) {
      details.push(product.ingredients?.length
        ? `Thành phần đã ghi nhận: ${product.ingredients.map((item) => typeof item === 'string' ? item : item.name).filter(Boolean).join(', ')}.`
        : 'Hệ thống chưa có dữ liệu thành phần được xác minh cho món này.');
    }
    if (plan.fields.includes('stock')) details.push('Tồn kho hiển thị là dữ liệu chung; chưa có tồn kho riêng theo chi nhánh.');
    return `• ${details.join('\n  ')}`;
  });
  const intro = plan.intent === 'compare' ? 'Mình so sánh các món theo thông tin hiện có nhé:'
    : budget ? `Các món phù hợp ngân sách ${budget.exclusive ? 'dưới' : 'tối đa'} ${currency(budget.max)} của bạn:`
    : plan.intent === 'product_info' ? 'Đây là thông tin sản phẩm hiện có tại True Juice:'
    : 'Mình tìm được những món này trong danh mục True Juice:';
  return `${intro}\n\n${lines.join('\n\n')}\n\nBạn có thể nhấn “Xem chi tiết” trên thẻ sản phẩm bên dưới.`;
}

function storeReply(stores, fields) {
  const wantsAddress = fields.includes('address') || fields.length === 0;
  const wantsHours = fields.includes('hours') || fields.length === 0;
  const rows = stores.map((store) => {
    const lines = [store.name];
    if (wantsAddress && store.address) lines.push(`Địa chỉ: ${store.address}`);
    if (wantsHours && (store.hours || store.time)) lines.push(`Giờ hoạt động công bố: ${store.hours || store.time}`);
    if (fields.includes('phone') && store.phone) lines.push(`Điện thoại: ${store.phone}`);
    if (fields.includes('amenities') && store.amenities?.length) lines.push(`Tiện ích: ${store.amenities.join(', ')}`);
    return `• ${lines.join('\n  ')}`;
  });
  const requestedFields = [
    ...(wantsAddress ? [['address', 'địa chỉ']] : []),
    ...(wantsHours ? [['hours', 'giờ hoạt động']] : []),
    ...(fields.includes('phone') ? [['phone', 'số điện thoại']] : []),
    ...(fields.includes('amenities') ? [['amenities', 'tiện ích']] : []),
  ];
  const missing = requestedFields.filter(([field]) => stores.some((store) => (
    field === 'hours' ? !(store.hours || store.time) : !store[field] && !(field === 'amenities' && store.amenities?.length)
  )));
  const note = missing.length ? `\n\nHệ thống chưa có thông tin đã xác minh về ${missing.map(([, label]) => label).join(', ')} cho một số chi nhánh.` : '';
  return `Thông tin chi nhánh True Juice trong hệ thống:\n\n${rows.join('\n\n')}${note}`;
}

function createChatService({
  getSnapshot = () => require('./catalogService').getCatalogSnapshot(),
  generatePlan = (input) => {
    if (!defaultGemini) defaultGemini = require('./geminiService').createGeminiService();
    return defaultGemini.generatePlan(input);
  },
} = {}) {
  return {
    async reply({ message, history = [] }) {
      if (blockedMessage(message)) return { success: true, reply: OUT_OF_SCOPE_REPLY, products: [] };
      if (containsSensitiveCredentials(message)) {
        return { success: true, reply: 'Bạn không cần gửi mật khẩu, token hoặc API key cho trợ lý. Mình chỉ cần tên món, sở thích, ngân sách hoặc chi nhánh bạn muốn tìm hiểu nhé.', products: [] };
      }
      if (/^(xin chao|chao|hello|hi)[!.?\s]*$/.test(normalize(message))) {
        return { success: true, reply: WELCOME_REPLY, products: [] };
      }
      let snapshot;
      try { snapshot = await getSnapshot(); }
      catch { throw new ChatError('CATALOG_UNAVAILABLE', 'Chưa đọc được dữ liệu sản phẩm và cửa hàng. Vui lòng thử lại sau.', 503); }
      // No model sees user IDs, JWT, payment data, database credentials or queries.
      const budget = conversationBudget(message, history);
      const namedMatches = explicitProductSearch(message, snapshot.products);
      const matchedNamedProducts = namedMatches?.length ? namedMatches : null;
      const priceLimit = comparativePriceLimit(message, history, snapshot.products);
      const candidates = snapshot.products.filter((product) => product.stock > 0
        && (!budget || (budget.exclusive ? product.price < budget.max : product.price <= budget.max)));
      const comparableCandidates = priceLimit == null ? candidates : candidates.filter((product) => product.price < priceLimit);
      const cheapest = isCheapestRequest(message)
        ? [...comparableCandidates].sort((a, b) => a.price - b.price || a.id - b.id)[0]
        : null;
      // Limit context deterministically; no vectors or uploads are needed for this catalog.
      const catalog = (cheapest ? [cheapest] : comparableCandidates).slice(0, 100);
      const stores = snapshot.stores.slice(0, 20);
      let plan = validatePlan(await generatePlan({ message, history: history.filter((item) => !containsSensitiveCredentials(item.content)), products: catalog, stores }));
      if (plan.scope === 'out_of_scope') return { success: true, reply: OUT_OF_SCOPE_REPLY, products: [] };
      if (plan.intent === 'greeting') return { success: true, reply: WELCOME_REPLY, products: [] };
      if (plan.intent === 'social' || plan.intent === 'clarify') {
        return { success: true, reply: plan.response.trim(), products: [] };
      }
      if (plan.intent === 'unknown_information') return { success: true, reply: UNKNOWN_REPLY, products: [] };
      if (plan.intent === 'stores') {
        const ids = [...new Set(plan.storeIds)];
        const selected = ids.map((id) => stores.find((store) => String(store.id) === id));
        if (selected.length === 0 || selected.some((store) => !store)) {
          return { success: true, reply: 'Mình chưa tìm thấy chi nhánh phù hợp trong dữ liệu hiện tại của True Juice.', products: [] };
        }
        return { success: true, reply: storeReply(selected, plan.fields), products: [] };
      }
      if (cheapest && (isProductIntent(plan.intent) || plan.intent === 'no_match')) {
        plan = { ...plan, intent: 'product_info', productIds: [cheapest.id], fields: ['price'] };
      }
      if (!isProductIntent(plan.intent) && plan.intent !== 'no_match') {
        return { success: true, reply: UNKNOWN_REPLY, products: [] };
      }
      const ids = [...new Set(plan.productIds)];
      const selected = ids.map((id) => catalog.find((product) => Number(product.id) === id));
      if (plan.intent === 'no_match' || selected.length === 0 || selected.some((product) => !product)
        || (plan.intent === 'compare' && selected.length < 2)
        || (matchedNamedProducts && selected.some((product) => !matchedNamedProducts.some((match) => match.id === product.id)))) {
        return { success: true, reply: NO_MATCH_REPLY, products: [] };
      }
      // Ignore every model-supplied fact: only approved IDs/field enums are accepted.
      return { success: true, reply: productReply(plan, selected, budget), products: selected };
    },
  };
}

let defaultGemini;
module.exports = { createChatService, validatePlan, extractBudget, conversationBudget, explicitProductSearch, comparativePriceLimit, isCheapestRequest, blockedMessage, OUT_OF_SCOPE_REPLY, NO_MATCH_REPLY, UNKNOWN_REPLY };
