function createChatRateLimit({ max = 10, windowMs = 60000, now = Date.now } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    // Prune on requests instead of keeping a background timer alive.
    for (const [key, entry] of buckets) if (entry.until <= time) buckets.delete(key);
    const key = req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
    let bucket = buckets.get(key);
    if (!bucket) { bucket = { count: 0, until: time + windowMs }; buckets.set(key, bucket); }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.until - time) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, code: 'CHAT_RATE_LIMIT', error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng đợi một chút rồi thử lại.', retryAfter });
    }
    return next();
  };
}

module.exports = { createChatRateLimit };
