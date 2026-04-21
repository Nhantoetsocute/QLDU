const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', orderController.getOrderHistory);
router.post('/', orderController.createOrder);
router.get('/:id', orderController.getOrderById);
router.put('/:id/cancel', orderController.cancelOrder);

module.exports = router;
