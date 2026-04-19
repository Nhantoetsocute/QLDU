const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const userController = require('../controllers/userController');
const verifyToken = require('../middleware/authMiddleware');

// Cấu hình multer để upload avatar
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/avatars'));
    },
    filename: (req, file, cb) => {
        // Tên file: avatar_<userId>_<timestamp>.<ext>
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `avatar_${req.user.userId}_${Date.now()}${ext}`);
    },
});

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP'));
        }
    },
});

router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, userController.updateProfile);
router.post('/avatar', verifyToken, uploadAvatar.single('avatar'), userController.uploadAvatar);

module.exports = router;
