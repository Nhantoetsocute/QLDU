// IP and account protection for a single server. Use a shared gateway limit for multiple replicas.
module.exports = function createAuthRateLimit({ limit = 20, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
    const entries = new Map();
    return (req, res, next) => {
        const time = now();
        for (const [key, value] of entries) if (value.until <= time) entries.delete(key);
        const keys = [`ip:${req.ip}`];
        if (typeof req.body?.email === 'string' && req.body.email.length <= 190) keys.push(`account:${req.body.email.trim().toLowerCase()}`);
        for (const key of keys) {
        let entry = entries.get(key);
        if (!entry) {
            if (entries.size >= 10000) return res.status(429).json({ error: 'Vui lòng thử lại sau.' });
            entry = { count: 0, until: time + windowMs };
            entries.set(key, entry);
        }
        if (++entry.count > limit) {
            res.set('Retry-After', String(Math.ceil((entry.until - time) / 1000)));
            return res.status(429).json({ error: 'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau.' });
        }
        }
        next();
    };
};
