const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');

router.get('/categories', foodController.getCategories);
router.get('/food', foodController.getFoods);
router.get('/food/:id', foodController.getFoodById);

module.exports = router;
