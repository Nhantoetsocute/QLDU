require('dotenv').config();
require('./src/config/auth').getSecret();
require('./src/config/auth').passwordHashRounds();
require('./src/security/cryptoVault').validateKeys();
const transport = require('./src/security/transport');
transport.validateTransportConfig();
const express = require('express');
const cors = require('cors');

// Import Routes phân hệ
const authRoutes = require('./src/routes/authRoutes');
const foodRoutes = require('./src/routes/foodRoutes');
const userRoutes = require('./src/routes/userRoutes');
const voucherRoutes = require('./src/routes/voucherRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const vnpayRoutes = require('./src/routes/vnpayRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const catalogRoutes = require('./src/routes/catalogRoutes');
const storeRoutes = require('./src/routes/storeRoutes');

const path = require('path');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', transport.trustedProxySetting());

// ======== MIDDLEWARE ========

// Parse JSON body (giới hạn size để chống abuse)
app.use(require('./src/middleware/securityHeaders'));
app.use(transport.requireSecureTransport());
app.use(express.json({ limit: '64kb' }));
app.use('/api', (req,res,next) => {
    if (['POST','PUT','PATCH'].includes(req.method) && req.path !== '/user/avatar' && !req.is('application/json')) return res.status(415).json({error:'Yêu cầu Content-Type application/json.'});
    next();
});

// CORS: cho phép app mobile kết nối
app.use(cors({ origin(origin, callback) {
    if (!origin) return callback(null,true);
    const allowed=(process.env.CORS_ORIGINS || '').split(',').map(v=>v.trim()).filter(Boolean);
    const local=process.env.NODE_ENV!=='production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    callback(null,allowed.includes(origin) || local);
} }));

// Serve ảnh sản phẩm tĩnh
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Avatars are served only by the authenticated /api/user/avatar endpoint.

// Request logger — ghi log mỗi request để debug
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(
            `${statusColor}${req.method}\x1b[0m ${req.route?.path || 'unmatched'} → ${res.statusCode} (${duration}ms)`
        );
    });
    next();
});

// ======== ROUTES ========
const PORT = process.env.PORT || 3000;

app.use('/api/auth', authRoutes);     // /api/auth/register, /api/auth/login
app.use('/api/privacy', require('./src/routes/privacyRoutes')());
app.use('/api/user', userRoutes);     // /api/user/profile
app.use('/api/vouchers', voucherRoutes); // /api/vouchers
app.use('/api/cart', cartRoutes);     // /api/cart
app.use('/api/orders', orderRoutes);  // /api/orders
app.use('/api/vnpay', vnpayRoutes);   // /api/vnpay/create-payment-url, /api/vnpay/return
app.use('/api/chat', chatRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/stores', storeRoutes);
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
    res.status(404).json({ error: 'API Endpoint không tồn tại' });
});

// Global error handler — bắt mọi lỗi không xử lý được
app.use(require('./src/middleware/securityErrors'));

// ======== GRACEFUL SHUTDOWN ========
let server;
const pool = require('./src/config/db');
require('./src/security/storageReadiness').assertStorageReady(pool).then(() => {
    server = app.listen(PORT, process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'), () => {
        console.log(`QuanLyBanNuoc Backend đang chạy tại: http://localhost:${PORT}`);
        console.log(` Health check: http://localhost:${PORT}/api/health`);
    });
}).catch(async error => {
    console.error('Không thể khởi động storage:', error.code || 'STORAGE_NOT_READY');
    await pool.end();
    process.exitCode = 1;
});

// Đóng server và DB pool sạch sẽ khi tắt process
const shutdown = (signal) => {
    console.log(`\nNhận tín hiệu ${signal}. Đang tắt server...`);
    if (!server) { pool.end().finally(() => process.exit(0)); return; }
    server.close(() => {
        const pool = require('./src/config/db');
        pool.end().then(() => {
            console.log('Database pool đã đóng. Tạm biệt!');
            process.exit(0);
        });
    });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
