const { createPrivacyService, PrivacyError } = require('../services/privacyService');

function createPrivacyController({ service = createPrivacyService({ pool: require('../config/db') }) } = {}) {
    function respondError(error, res, next) {
        if (error instanceof PrivacyError) return res.status(error.status).json({ error: error.message, code: error.code });
        return next(error);
    }
    return {
        async exportData(req, res, next) {
            try {
                const data = await service.exportData(req.user.userId);
                res.set('Cache-Control', 'no-store');
                res.set('Content-Disposition', 'attachment; filename="true-juice-personal-data.json"');
                res.json(data);
            } catch (error) { respondError(error, res, next); }
        },
        async closeAccount(req, res, next) {
            try {
                const body = req.body;
                if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'password')
                    || typeof body.password !== 'string' || !body.password.length || Buffer.byteLength(body.password) > 256) {
                    return res.status(400).json({ error: 'Yêu cầu cần duy nhất mật khẩu hiện tại.', code: 'INVALID_REAUTHENTICATION' });
                }
                const result = await service.closeAccount(req.user.userId, body.password);
                res.set('Cache-Control', 'no-store');
                res.json({ message: 'Đã đóng tài khoản và xóa thông tin cá nhân. Bản ghi kế toán đã ẩn danh được giữ lại.', ...result });
            } catch (error) { respondError(error, res, next); }
        },
    };
}
module.exports = { createPrivacyController };
