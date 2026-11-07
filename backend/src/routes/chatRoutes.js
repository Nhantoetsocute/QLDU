const express = require('express');
const verifyToken = require('../middleware/authMiddleware');
const { createChatRateLimit } = require('../middleware/chatRateLimit');
const { createChatController } = require('../controllers/chatController');

function createChatRouter({ service, authenticate = verifyToken, rateLimit = createChatRateLimit() } = {}) {
  const router = express.Router();
  router.post('/', authenticate, rateLimit, createChatController(service));
  return router;
}

module.exports = createChatRouter();
module.exports.createChatRouter = createChatRouter;
