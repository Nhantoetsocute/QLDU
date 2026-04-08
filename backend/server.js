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

// ======== MIDDLEWARE ========

// Parse JSON body (giới hạn size để chống abuse)
app.use(express.json({ limit: '2mb' }));

// CORS: cho phép app mobile kết nối
app.use(cors());

// Request logger — ghi log mỗi request để debug
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(
            `${statusColor}${req.method}\x1b[0m ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
        );
    });
    next();
});

// ======== ROUTES ========
const PORT = process.env.PORT || 3000;

app.use('/api/auth', authRoutes);     // /api/auth/register, /api/auth/login
app.use('/api/user', userRoutes);     // /api/user/profile
app.use('/api/vouchers', voucherRoutes); // /api/vouchers
app.use('/api/cart', cartRoutes);     // /api/cart
app.use('/api/orders', orderRoutes);  // /api/orders
app.use('/api', foodRoutes);          // /api/food, /api/categories

// ======== HEALTH CHECK ========
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// ======== ERROR HANDLING ========

// 404 — Route không tồn tại
app.use((req, res, next) => {
    res.status(404).json({ error: `API Endpoint không tồn tại: ${req.method} ${req.originalUrl}` });
});

// Global error handler — bắt mọi lỗi không xử lý được
app.use((err, req, res, next) => {
    console.error('💥 Unhandled Error:', err.stack || err.message);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
});

// ======== GRACEFUL SHUTDOWN ========
const server = app.listen(PORT, () => {
    console.log(`🚀 QuanLyBanNuoc Backend đang chạy tại: http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Đóng server và DB pool sạch sẽ khi tắt process
const shutdown = (signal) => {
    console.log(`\n🛑 Nhận tín hiệu ${signal}. Đang tắt server...`);
    server.close(() => {
        const pool = require('./src/config/db');
        pool.end().then(() => {
            console.log('✅ Database pool đã đóng. Tạm biệt!');
            process.exit(0);
        });
    });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
