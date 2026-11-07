const express = require('express');
const { getStoreInformation } = require('../services/catalogService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stores = await getStoreInformation();
    res.json({ success: true, stores });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Chưa thể tải thông tin cửa hàng. Vui lòng thử lại sau.' });
  }
});

module.exports = router;
