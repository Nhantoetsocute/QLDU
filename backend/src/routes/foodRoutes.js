const { paramId, foodQuery } = require('../security/validation');
const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');

router.get('/categories', foodController.getCategories);
router.get('/food', foodQuery, foodController.getFoods);
router.get('/food/:id', paramId, foodController.getFoodById);

module.exports = router;
