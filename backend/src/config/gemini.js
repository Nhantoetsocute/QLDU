const { ChatError } = require('../services/chatErrors');

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

function getGeminiConfig(env = process.env) {
  const apiKey = (env.GEMINI_API_KEY || '').trim();
  if (!apiKey || /^(YOUR_|REPLACE_|YOUR-)/i.test(apiKey)) {
    throw new ChatError('GEMINI_NOT_CONFIGURED',
      'Trợ lý AI chưa được cấu hình. Hãy thêm GEMINI_API_KEY vào backend/.env rồi khởi động lại backend.');
  }
  const model = (env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  // Deliberately no fallback: changing model must be an explicit code/config review.
  if (model !== DEFAULT_MODEL) {
    throw new ChatError('GEMINI_MODEL_NOT_ALLOWED',
      `Model chưa được xác minh Free Tier. Hãy dùng GEMINI_MODEL=${DEFAULT_MODEL}.`);
  }
  return { apiKey, model };
}

module.exports = { DEFAULT_MODEL, getGeminiConfig };
