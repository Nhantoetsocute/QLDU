const { validate } = require('../security/validation');
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');

const authLimit = require('../middleware/authRateLimit')();
router.use((req,res,next) => req.method === 'POST' ? authLimit(req,res,next) : next());

router.post('/register', validate('register'), authController.register);
router.post('/login', validate('login'), authController.login);
router.post('/change-password', verifyToken, validate('changePassword'), authController.changePassword);
router.get('/profile', verifyToken, authController.getProfile);

router.post('/forgot-password', validate('forgot'), authController.forgotPassword);
router.post('/verify-otp', validate('otp'), authController.verifyOTP);
router.post('/reset-password', validate('reset'), authController.resetPassword);

module.exports = router;
