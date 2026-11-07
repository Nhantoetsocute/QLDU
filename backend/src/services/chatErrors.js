class ChatError extends Error {
  constructor(code, message, status = 503, retryAfter) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

module.exports = { ChatError };
