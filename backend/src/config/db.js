const mysql = require('mysql2/promise');
const { databaseTlsOptions } = require('../security/transport');

// Kết nối Database Promise-based — Tối ưu hóa connection pool
const pool = mysql.createPool({
    ssl: databaseTlsOptions(),
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Tối ưu: Tự động giải phóng connection không dùng
    idleTimeout: 60000,       // đóng connection idle sau 60s
    enableKeepAlive: true,     // giữ kết nối TCP sống
    keepAliveInitialDelay: 10000,
    // Tối ưu: Timezone và charset
    timezone: '+07:00',
    charset: 'utf8mb4',
});

// Kiểm tra kết nối khi khởi động
pool.getConnection()
    .then(conn => {
        console.log('MySQL kết nối thành công');
        conn.release();
    })
    .catch(err => {
        console.error('MySQL kết nối thất bại:', err.code || 'DATABASE_ERROR');
    });

module.exports = pool;
