const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetDB() {
  try {
    // Kết nối đến MySQL nhưng không chỉ định database cụ thể
    // Cho phép chạy nhiều lệnh cùng lúc (multipleStatements)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    console.log("Bắt đầu kết nối MySQL và Reset Database...");

    // Đọc file SQL đã được sửa
    const sqlPath = path.join(__dirname, '../database/QuanLyBanNuoc.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Thực thi toàn bộ lệnh trong file SQL
    await connection.query(sql);

    console.log("Đã Xóa DB cũ, Tạo DB mới và import tất cả các bảng.");
    await connection.end();
  } catch (error) {
    console.error("Xảy ra lỗi khi chạy SQL:", error.message);
  }
}

resetDB();
