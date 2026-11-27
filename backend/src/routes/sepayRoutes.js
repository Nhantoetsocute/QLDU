const express = require('express');
const { validate, sepayCheckoutParams, sepayReturnQuery } = require('../security/validation');
const sepayController = require('../controllers/sepayController');
const verifyToken = require('../middleware/authMiddleware');
const router = express.Router();

// Tạo đơn + link thanh toán — cần đăng nhập
router.post('/create-payment', verifyToken, validate('payment'), sepayController.createPayment);
// Trang tự gửi form đã ký sang SePay — WebView mở
router.get('/checkout/:orderCode', sepayCheckoutParams, sepayController.checkout);
// SePay chuyển trình duyệt về — public, chỉ hiển thị / hủy đơn khi token đúng
router.get('/return', sepayReturnQuery, sepayController.sepayReturn);
// SePay IPN server-to-server — xác thực bằng header X-Secret-Key
router.post('/ipn', sepayController.sepayIpn);

module.exports = router;
