const express = require('express');
const router = express.Router();
const vnpayController = require('../controllers/vnpayController');
const verifyToken = require('../middleware/authMiddleware');

// Tạo URL thanh toán — cần đăng nhập
router.post('/create-payment-url', verifyToken, vnpayController.createPaymentUrl);

// VNPay redirect về sau thanh toán — public (VNPay gọi)
router.get('/return', vnpayController.vnpayReturn);

// VNPay server-to-server IPN — public (VNPay gọi)
router.get('/ipn', vnpayController.vnpayIPN);

module.exports = router;
