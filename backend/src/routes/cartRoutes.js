const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const verifyToken = require('../middleware/authMiddleware');

// Các tác vụ giỏ hàng luôn cần đăng nhập
router.use(verifyToken);

router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.put('/:id', cartController.updateCartItem);
router.delete('/clear', cartController.clearCart);  // Xóa toàn bộ giỏ
router.delete('/:id', cartController.removeFromCart);

module.exports = router;
