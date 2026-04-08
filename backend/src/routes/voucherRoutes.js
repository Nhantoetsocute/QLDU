const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

router.get('/', voucherController.getVouchers);
router.post('/validate', voucherController.validateVoucher);  // Validate mã voucher

module.exports = router;
