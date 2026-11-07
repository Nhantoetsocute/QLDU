const { validate, paramId } = require('../security/validation');
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', orderController.getOrderHistory);
router.post('/', validate('order'), orderController.createOrder);
router.get('/:id', paramId, orderController.getOrderById);
router.put('/:id/cancel', paramId, orderController.cancelOrder);

module.exports = router;
