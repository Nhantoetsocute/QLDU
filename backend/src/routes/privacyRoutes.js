const express = require('express');
const authenticate = require('../middleware/authMiddleware');
const createRateLimit = require('../middleware/authRateLimit');
const { createPrivacyController } = require('../controllers/privacyController');

function accountLimit(limit) {
    const apply = createRateLimit({ limit, windowMs: 15 * 60 * 1000 });
    return (req, res, next) => apply({ ip: `privacy-user:${req.user.userId}` }, res, next);
}
function createPrivacyRouter({ verifyToken = authenticate, service, exportLimit = accountLimit(3), deleteLimit = accountLimit(5) } = {}) {
    const router = express.Router();
    const controller = createPrivacyController(service ? { service } : {});
    router.use(verifyToken);
    router.get('/export', exportLimit, controller.exportData);
    router.post('/delete-account', deleteLimit, controller.closeAccount);
    return router;
}
module.exports = createPrivacyRouter;
module.exports.createPrivacyRouter = createPrivacyRouter;
