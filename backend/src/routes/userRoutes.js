const { validate } = require('../security/validation');
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyToken = require('../middleware/authMiddleware');

const { avatarUpload } = require('../middleware/avatarUpload');

router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, validate('profile'), userController.updateProfile);
router.get('/avatar', verifyToken, require('../controllers/avatarController'));
router.post('/avatar', verifyToken, require('../middleware/authRateLimit')({limit:10}), avatarUpload, userController.uploadAvatar);

module.exports = router;
