# QuanLyBanNuoc (QLDU)

Ứng dụng quản lý bán nước — React Native (Expo) + Node.js Express + MySQL.
## Thành viên nhóm

| STT | Họ và tên | MSSV |
|:---:|-----------|------|
| 1 | Nguyễn Văn Kiên | 23810310138 |
| 2 | Đỗ Quang Hà | 23810310132 |
| 3 | Nguyễn Bá Nhân | 23810310144 |
---

## Yêu cầu hệ thống

| Công cụ        | Phiên bản       | Ghi chú                        |
| -------------- | --------------- | ------------------------------ |
| **Node.js**    | ≥ 18            | [nodejs.org](https://nodejs.org) |
| **MySQL**      | ≥ 8.0           | Có sẵn trong XAMPP             |
| **XAMPP**      | Bất kì          | Bật Apache + MySQL             |
| **Expo CLI**   | Cài qua npx     | Không cần cài global           |
| **Expo Go**    | App trên điện thoại | Tải từ App Store / Google Play |

---

## Hướng dẫn cài đặt (3 bước)

### Bước 1: Tạo Database

1. Mở **XAMPP** → Start **MySQL**
2. Mở **phpMyAdmin** (http://localhost/phpmyadmin)
3. Vào tab **Import** → chọn file `database/QuanLyBanNuoc.sql` → nhấn **Go**
   
   Hoặc dùng CLI:
   ```bash
   cd backend
   npm install
   npm run reset-db
   ```

> File SQL sẽ tự động tạo database `quanlybannuoc`, tất cả bảng, và dữ liệu mẫu (sản phẩm, voucher, bàn...).

### Bước 2: Chạy Backend

```bash
cd backend

# Copy file env mẫu
cp .env.example .env
# (Trên Windows: copy .env.example .env)

# Cài dependencies
npm install

# Chạy server
npm start
```

Backend sẽ chạy tại `http://localhost:3000`. Kiểm tra: http://localhost:3000/api/health

### Bước 3: Chạy Frontend (App Mobile)

```bash
# Ở thư mục gốc project
npm install

npm start
```

Scan QR code bằng app **Expo Go** trên điện thoại (cùng mạng WiFi với máy tính).

---

## Cấu trúc dự án

```
QLDU/
├── App.js                    # Entry point — Navigation
├── assets/images/            # Ảnh local (banner, sản phẩm)
├── src/
│   ├── config/api.js         # Auto-detect API URL
│   ├── context/              # React Context (User, Cart)
│   ├── navigation/           # Bottom Tab Navigator
│   ├── screens/              # Tất cả màn hình
│   └── theme/                # Dark/Light theme
├── backend/
│   ├── .env.example          # ← Template cấu hình
│   ├── server.js             # Express entry point
│   ├── reset-db.js           # Reset & import database
│   ├── seed_food.js          # Seed sản phẩm
│   ├── public/images/        # Ảnh sản phẩm (serve static)
│   └── src/
│       ├── config/db.js      # MySQL connection pool
│       ├── middleware/        # JWT auth
│       ├── controllers/      # Business logic
│       └── routes/           # API endpoints
└── database/
    └── QuanLyBanNuoc.sql     # Full database schema + seed
```

---

## API Endpoints

| Method | Endpoint                        | Auth | Mô tả                    |
| ------ | ------------------------------- | ---- | ------------------------- |
| POST   | `/api/auth/register`            | ❌   | Đăng ký                  |
| POST   | `/api/auth/login`               | ❌   | Đăng nhập                |
| GET    | `/api/user/profile`             | ✅   | Lấy thông tin user       |
| PUT    | `/api/user/profile`             | ✅   | Cập nhật profile         |
| GET    | `/api/food`                     | ❌   | Danh sách sản phẩm       |
| GET    | `/api/categories`               | ❌   | Danh mục                 |
| GET    | `/api/vouchers`                 | ❌   | Danh sách voucher        |
| GET    | `/api/cart`                     | ✅   | Xem giỏ hàng             |
| POST   | `/api/cart`                     | ✅   | Thêm vào giỏ             |
| POST   | `/api/orders`                   | ✅   | Tạo đơn hàng (COD)       |
| GET    | `/api/orders`                   | ✅   | Lịch sử đơn hàng         |
| PUT    | `/api/orders/:id/cancel`        | ✅   | Hủy đơn hàng             |
| POST   | `/api/vnpay/create-payment-url` | ✅   | Tạo link thanh toán VNPay |

---

## Biến môi trường (Backend)

Xem file `backend/.env.example` để biết tất cả biến cần thiết.

| Biến              | Mô tả                                  |
| ----------------- | --------------------------------------- |
| `PORT`            | Port server (mặc định: 3000)           |
| `DB_HOST`         | MySQL host (mặc định: 127.0.0.1)      |
| `DB_USER`         | MySQL username (mặc định: root)        |
| `DB_PASSWORD`     | MySQL password (mặc định: rỗng)        |
| `DB_NAME`         | Tên database                            |
| `JWT_SECRET`      | Secret key cho JWT token               |
| `VNP_TMN_CODE`    | Mã TMN từ VNPay Sandbox               |
| `VNP_HASH_SECRET` | Hash secret từ VNPay Sandbox           |
| `VNP_HOST`        | VNPay gateway URL                      |
| `VNP_TEST_MODE`   | `true` = sandbox, `false` = production |

---

## Scripts Backend

```bash
npm start        # Chạy server
npm run reset-db # Xóa + tạo lại database từ file SQL
npm run seed     # Seed dữ liệu sản phẩm
npm run setup    # reset-db + seed (chạy 1 lần khi mới clone)
```

---

