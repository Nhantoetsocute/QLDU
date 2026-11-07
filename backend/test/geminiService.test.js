const test = require('node:test');
const assert = require('node:assert/strict');
const { createGeminiService, mapGeminiError, redactSensitiveText, PLAN_SCHEMA, SYSTEM_INSTRUCTION } = require('../src/services/geminiService');
const { ChatError } = require('../src/services/chatErrors');

const MODEL = 'gemini-3.5-flash-lite';
const FAKE_KEY = 'AIzaTestOnlyNotARealApiKey123456789012345';
const ENV = { GEMINI_API_KEY: FAKE_KEY, GEMINI_MODEL: MODEL };
const PLAN = { scope: 'in_scope', intent: 'recommend', productIds: [1], storeIds: [], fields: ['price'], response: '' };
const INPUT = {
  message: 'Có món nào dưới 50000 đồng?', history: [],
  products: [{ id: 1, name: 'Trà mẫu', price: 35000, stock: 2, description: 'Mô tả mẫu', categoryName: 'Trà', image: '/images/sample.jpg', dbPassword: 'must-not-send' }],
  stores: [{ id: '1', name: 'Chi nhánh mẫu', address: 'Địa chỉ mẫu', hours: '08:00 - 22:00', phone: 'Số điện thoại cửa hàng', amenities: ['Wifi'], internalNotes: 'must-not-send' }],
};

function setup({ env = { ...ENV }, info = { name: `models/${MODEL}`, supportedActions: ['generateContent'] }, failure, responseText = JSON.stringify(PLAN), getFailure } = {}) {
  const calls = { client: [], get: [], generate: [] };
  const clientFactory = (options) => {
    calls.client.push(options);
    return { models: {
      get: async (request) => { calls.get.push(request); if (getFailure) throw getFailure; return info; },
      generateContent: async (request) => { calls.generate.push(request); if (failure) throw failure; return { text: responseText }; },
    } };
  };
  return { service: createGeminiService({ env, clientFactory }), calls, env };
}

test('missing or placeholder API key never creates a client or makes external calls', async () => {
  for (const key of [undefined, '', '   ', 'YOUR_NEW_GEMINI_API_KEY', 'REPLACE_WITH_KEY']) {
    const { service, calls } = setup({ env: { GEMINI_API_KEY: key } });
    await assert.rejects(service.generatePlan(INPUT), { code: 'GEMINI_NOT_CONFIGURED' });
    assert.deepEqual(calls, { client: [], get: [], generate: [] });
  }
});

test('unapproved model is rejected without a paid fallback or external call', async () => {
  const { service, calls } = setup({ env: { ...ENV, GEMINI_MODEL: 'different-paid-model' } });
  await assert.rejects(service.generatePlan(INPUT), { code: 'GEMINI_MODEL_NOT_ALLOWED' });
  assert.deepEqual(calls, { client: [], get: [], generate: [] });
});

test('uses exact configured model, checks metadata, requests bounded JSON and disables automatic retries', async () => {
  const { service, calls } = setup();
  assert.deepEqual(await service.generatePlan(INPUT), PLAN);
  assert.deepEqual(calls.get, [{ model: MODEL }]);
  assert.equal(calls.generate.length, 1);
  assert.equal(calls.client.length, 1);
  assert.equal(calls.client[0].apiKey, FAKE_KEY);
  assert.equal(calls.client[0].httpOptions.retryOptions.attempts, 1);
  const request = calls.generate[0];
  assert.equal(request.model, MODEL);
  assert.equal(request.config.systemInstruction, SYSTEM_INSTRUCTION);
  assert.equal(request.config.responseMimeType, 'application/json');
  assert.deepEqual(request.config.responseJsonSchema, PLAN_SCHEMA);
  assert.ok(PLAN_SCHEMA.properties.intent.enum.includes('social'));
  assert.ok(PLAN_SCHEMA.properties.intent.enum.includes('clarify'));
  assert.equal(PLAN_SCHEMA.properties.response.type, 'string');
  assert.match(SYSTEM_INSTRUCTION, /intent=social/);
  assert.match(SYSTEM_INSTRUCTION, /intent=clarify/);
  assert.equal(request.config.automaticContinuation, false);
  assert.equal(request.config.httpOptions.retryOptions.attempts, 1);
  assert.ok(request.config.httpOptions.timeout > 0 && request.config.httpOptions.timeout <= 12000);
  assert.ok(request.config.maxOutputTokens > 0 && request.config.maxOutputTokens <= 1024);
  assert.ok(!request.config.tools);
  assert.ok(!JSON.stringify(request.contents).includes('must-not-send'));
  assert.ok(!JSON.stringify(request.contents).includes(FAKE_KEY));
});

test('metadata verification is reused instead of calling models.get for every user message', async () => {
  const { service, calls } = setup();
  await service.generatePlan(INPUT);
  await service.generatePlan(INPUT);
  assert.equal(calls.get.length, 1);
  assert.equal(calls.generate.length, 2);
});

test('metadata must identify a model that supports generation before sending a generation request', async () => {
  for (const info of [{}, { name: `models/${MODEL}`, supportedActions: ['embedContent'] }]) {
    const { service, calls } = setup({ info });
    await assert.rejects(service.generatePlan(INPUT), { code: 'GEMINI_MODEL_UNAVAILABLE' });
    assert.equal(calls.generate.length, 0);
  }
});

test('model metadata failure blocks generation and returns a safe unavailable-model error', async () => {
  const { service, calls } = setup({ getFailure: { status: 404, message: `not found with secret ${FAKE_KEY}` } });
  await assert.rejects(service.generatePlan(INPUT), (error) => {
    assert.equal(error.code, 'GEMINI_MODEL_UNAVAILABLE');
    assert.ok(!error.message.includes(FAKE_KEY));
    return true;
  });
  assert.equal(calls.get.length, 1);
  assert.equal(calls.generate.length, 0);
});

test('invalid key and quota errors are localized without retries, model switching, or leaked provider text', async () => {
  for (const [failure, expected] of [
    [{ status: 400, message: `API key not valid ${FAKE_KEY}` }, 'GEMINI_KEY_INVALID'],
    [{ status: 403, message: `denied ${FAKE_KEY}` }, 'GEMINI_KEY_INVALID'],
    [{ status: 429, message: `quota exceeded ${FAKE_KEY}` }, 'GEMINI_QUOTA_EXCEEDED'],
  ]) {
    const { service, calls } = setup({ failure });
    await assert.rejects(service.generatePlan(INPUT), (error) => {
      assert.equal(error.code, expected);
      assert.ok(!error.message.includes(FAKE_KEY));
      if (expected === 'GEMINI_QUOTA_EXCEEDED') { assert.equal(error.status, 429); assert.ok(error.retryAfter > 0); }
      return true;
    });
    assert.equal(calls.generate.length, 1);
    assert.equal(calls.client.length, 1);
    assert.equal(calls.generate[0].model, MODEL);
  }
});

test('timeouts, network disconnection, and provider outages become distinct safe errors', async () => {
  for (const [failure, code, status] of [
    [{ name: 'AbortError', message: 'Aborted' }, 'GEMINI_TIMEOUT', 504],
    [{ status: 408, message: 'Request expired' }, 'GEMINI_TIMEOUT', 504],
    [{ status: 504, message: 'Gateway failure' }, 'GEMINI_TIMEOUT', 504],
    [new TypeError('fetch failed'), 'GEMINI_UNAVAILABLE', 503],
    [{ status: 503, message: 'Service unavailable' }, 'GEMINI_UNAVAILABLE', 503],
  ]) {
    const safe = mapGeminiError(failure);
    assert.equal(safe.code, code);
    assert.equal(safe.status, status);
  }
});

test('an existing safe ChatError is preserved', () => {
  const original = new ChatError('TEST_SAFE_ERROR', 'Thông báo an toàn', 502);
  assert.equal(mapGeminiError(original), original);
});

test('malformed model JSON is rejected without another provider call', async () => {
  for (const responseText of ['not JSON', '', '{"scope":']) {
    const { service, calls } = setup({ responseText });
    await assert.rejects(service.generatePlan(INPUT), { code: 'GEMINI_INVALID_RESPONSE', status: 502 });
    assert.equal(calls.generate.length, 1);
  }
});

test('only bounded chat context is sent and common secrets/PII are redacted', async () => {
  const { service, calls } = setup();
  const message = `Liên hệ demo@example.com 0912345678 Bearer jwt-secret-token ${FAKE_KEY} 1234567890123456`;
  const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `Turn ${i}: ` + 'a'.repeat(700), token: 'must-not-send' }));
  await service.generatePlan({ ...INPUT, message, history });
  const sent = JSON.parse(calls.generate[0].contents);
  assert.equal(sent.history.length, 6);
  assert.ok(sent.history.every((item) => item.content.length <= 600));
  assert.ok(sent.history[0].content.startsWith('Turn 6:'));
  for (const secret of ['demo@example.com', '0912345678', 'jwt-secret-token', FAKE_KEY, '1234567890123456', 'must-not-send']) assert.ok(!calls.generate[0].contents.includes(secret), secret);
  assert.deepEqual(Object.keys(sent.history[0]).sort(), ['content', 'role']);
  assert.ok(redactSensitiveText(message).includes('đã ẩn'));
});
