const { validate } = require('../security/validation');
const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

router.get('/', voucherController.getVouchers);
router.post('/validate', validate('voucher'), voucherController.validateVoucher);  // Validate mã voucher

module.exports = router;
