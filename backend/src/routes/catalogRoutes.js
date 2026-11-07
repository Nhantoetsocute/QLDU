const express = require('express');
const catalog = require('../services/catalogService');

const router = express.Router();

// Public catalog used by the native app and the read-only chatbot.
router.get('/', async (req, res) => {
  try {
    const { products } = await catalog.getCatalogSnapshot();
    const categoryMap = new Map(products.map((product) => [product.categoryId, {
      id: product.categoryId,
      name: product.categoryName,
    }]));
    res.json({ success: true, products, categories: [...categoryMap.values()] });
  } catch (error) {
    console.error('Catalog query failed:', error.code || 'DATABASE_ERROR');
    res.status(503).json({ success: false, error: 'Chưa thể tải sản phẩm. Vui lòng thử lại sau.' });
  }
});

module.exports = router;
