const { createChatService } = require('../services/chatService');
const { ChatError } = require('../services/chatErrors');

function validateChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1000) {
    throw new ChatError('INVALID_MESSAGE', 'Câu hỏi phải có từ 1 đến 1.000 ký tự.', 400);
  }
  const history = body.history === undefined ? [] : body.history;
  if (!Array.isArray(history) || history.length > 12
    || history.some((item) => !item || typeof item !== 'object' || !['user', 'assistant'].includes(item.role)
      || typeof item.content !== 'string' || !item.content.trim() || item.content.length > 4000)
    || history.reduce((total, item) => total + item.content.length, 0) > 16000) {
    throw new ChatError('INVALID_HISTORY', 'Lịch sử chat không hợp lệ hoặc quá dài. Hãy bắt đầu cuộc trò chuyện mới.', 400);
  }
  return { message: body.message.trim(), history: history.map(({ role, content }) => ({ role, content })) };
}

function createChatController(service = createChatService()) {
  return async (req, res) => {
    try {
      if (req.body?.aiConsent !== true) throw new ChatError('AI_CONSENT_REQUIRED',
        'Bạn cần đồng ý gửi nội dung chat tới Google Gemini trước khi sử dụng trợ lý.', 403);
      const input = validateChatRequest(req.body);
      res.json(await service.reply(input));
    } catch (error) {
      const safe = error instanceof ChatError ? error
        : new ChatError('CHAT_UNAVAILABLE', 'Trợ lý AI đang tạm thời gián đoạn. Bạn có thể thử lại sau.', 503);
      if (safe.retryAfter) res.set('Retry-After', String(safe.retryAfter));
      // Never return or log provider errors, submitted chat messages, or API keys.
      res.status(safe.status).json({ success: false, code: safe.code, error: safe.message, ...(safe.retryAfter ? { retryAfter: safe.retryAfter } : {}) });
    }
  };
}

module.exports = { createChatController, validateChatRequest };
