require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import Routes phân hệ
const authRoutes = require('./src/routes/authRoutes');
const foodRoutes = require('./src/routes/foodRoutes');
const userRoutes = require('./src/routes/userRoutes');
const voucherRoutes = require('./src/routes/voucherRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const orderRoutes = require('./src/routes/orderRoutes');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Thiết lập cổng & Môi trường
const PORT = process.env.PORT || 3000;

// Gắn các Routes vào App
app.use('/api/auth', authRoutes); // /api/auth/register, /api/auth/login
app.use('/api/user', userRoutes); // /api/user/profile
app.use('/api/vouchers', voucherRoutes); // /api/vouchers
app.use('/api/cart', cartRoutes); // /api/cart
app.use('/api/orders', orderRoutes); // /api/orders
app.use('/api', foodRoutes); // /api/food, /api/categories

// Xử lý lỗi 404 (Route không tồn tại)
app.use((req, res, next) => {
    res.status(404).json({ error: "API Endpoint không tồn tại!" });
});

// Chạy server
app.listen(PORT, () => {
    console.log(`🚀 QuanLyBanNuoc Backend Server đang chạy tại: http://localhost:${PORT}`);
});
