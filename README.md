# 🧃 True Juice — Ứng dụng Đặt Nước Uống

## 👥 Thành viên nhóm

| STT | Họ và tên | MSSV |
|:---:|-----------|------|
| 1 | Nguyễn Văn Kiên | 23810310138 |
| 2 | Đỗ Quang Hà | 23810310132 |
| 3 | Nguyễn Bá Nhân | 23810310144 |

---

## 📋 Mô tả hệ thống

**True Juice** là ứng dụng di động đặt nước uống, được xây dựng bằng **React Native (Expo)** cho phía client và **Node.js + Express** cho phía server, kết nối cơ sở dữ liệu **MySQL 8+**.

Ứng dụng cho phép người dùng duyệt menu, thêm sản phẩm vào giỏ hàng, đặt hàng giao tận nơi, thanh toán bằng tiền mặt (COD) hoặc qua cổng VNPAY, theo dõi trạng thái đơn hàng, và quản lý tài khoản cá nhân.

---

## ✨ Tính năng chính

- 🔐 **Đăng nhập / Đăng ký** — Xác thực người dùng qua email, hỗ trợ quên mật khẩu (OTP).
- 🏠 **Trang chủ** — Banner quảng cáo dạng slider, danh mục sản phẩm, sản phẩm nổi bật.
- 📋 **Menu** — Duyệt toàn bộ sản phẩm theo danh mục (Cà phê, Trà trái cây, Sinh tố, …).
- 🔍 **Chi tiết sản phẩm** — Xem mô tả, chọn Size (S/M/L), Topping, thêm vào giỏ hàng.
- 🛒 **Giỏ hàng** — Quản lý số lượng, xóa sản phẩm, tính tổng tiền tự động.
- 📦 **Đặt hàng & Thanh toán** — Nhập thông tin giao hàng, chọn COD hoặc VNPAY, áp dụng voucher giảm giá.
- 📜 **Lịch sử đơn hàng** — Theo dõi trạng thái (Đang chuẩn bị → Đang giao → Hoàn thành).
- 🗺️ **Cửa hàng** — Xem vị trí các chi nhánh trên bản đồ (Google Maps).
- 🎫 **Ưu đãi** — Danh sách voucher và chương trình khuyến mãi.
- 👤 **Hồ sơ cá nhân** — Cập nhật tên, email, số điện thoại, địa chỉ, ảnh đại diện.
- 🔔 **Thông báo** — Nhận thông báo đơn hàng và khuyến mãi.
- 🌙 **Dark Mode** — Hỗ trợ giao diện tối/sáng.
- 🌐 **Đa ngôn ngữ** — Hỗ trợ chuyển đổi ngôn ngữ.

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────┐
│              Mobile App (React Native)          │
│  Expo · React Navigation · Context API          │
└──────────────────────┬──────────────────────────┘
                       │  REST API (HTTP)
┌──────────────────────▼──────────────────────────┐
│              Backend (Node.js + Express)         │
│  Controllers · Routes · Middleware               │
└──────────────────────┬──────────────────────────┘
                       │  mysql2
┌──────────────────────▼──────────────────────────┐
│              Database (MySQL 8+)                 │
│  QuanLyBanNuoc                                   │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ Công nghệ sử dụng

### Frontend (Mobile)
| Công nghệ | Phiên bản |
|------------|-----------|
| React Native | 0.81.5 |
| Expo | 54.x |
| React Navigation | 7.x |
| AsyncStorage | 2.2.0 |
| Expo Image Picker | 17.x |
| React Native Maps | 1.20.1 |
| React Native WebView | 13.15.0 |

### Backend
| Công nghệ | Mô tả |
|------------|-------|
| Node.js | Runtime |
| Express.js | Web framework |
| mysql2 | MySQL driver |
| JWT | Xác thực token |
| bcrypt | Mã hóa mật khẩu |

### Database
| Công nghệ | Mô tả |
|------------|-------|
| MySQL 8+ | Hệ quản trị CSDL quan hệ |
| utf8mb4 | Hỗ trợ tiếng Việt & emoji |

---

## 📁 Cấu trúc thư mục

```
QLDU/
├── App.js                  # Entry point, cấu hình Navigation
├── package.json            # Dependencies frontend
├── metro.config.js         # Cấu hình Metro bundler
│
├── src/
│   ├── screens/            # 20 màn hình giao diện
│   │   ├── HomeScreen.js
│   │   ├── LoginScreen.js
│   │   ├── SignUpScreen.js
│   │   ├── MenuScreen.js
│   │   ├── CartScreen.js
│   │   ├── CheckoutScreen.js
│   │   ├── ProductDetailScreen.js
│   │   ├── OrderHistoryScreen.js
│   │   ├── StoreScreen.js
│   │   ├── ProfileScreen.js
│   │   └── ...
│   ├── components/         # Component tái sử dụng
│   ├── context/            # Context API (Cart, UserProfile)
│   ├── config/             # Cấu hình API URL
│   ├── navigation/         # Cấu hình điều hướng
│   ├── theme/              # Dark/Light mode
│   └── mocks/              # Dữ liệu mẫu
│
├── backend/
│   ├── server.js           # Express server entry
│   ├── .env                # Biến môi trường (DB config)
│   ├── seed_food.js        # Script seed dữ liệu sản phẩm
│   ├── src/
│   │   ├── config/         # Kết nối database
│   │   ├── controllers/    # Xử lý logic nghiệp vụ
│   │   ├── routes/         # Định tuyến API
│   │   └── middleware/     # Xác thực, phân quyền
│   └── tests/              # Test API
│
├── database/
│   └── QuanLyBanNuoc.sql   # Script tạo CSDL (15 bảng)
│
└── assets/
    └── images/             # Hình ảnh sản phẩm & banner
```

---

## 🗄️ Cơ sở dữ liệu

Database **QuanLyBanNuoc** gồm **15 bảng** chính:

| Nhóm | Bảng | Mô tả |
|------|------|-------|
| Người dùng | `Users` | Thông tin tài khoản, OTP |
| | `DeliveryAddresses` | Địa chỉ giao hàng đã lưu |
| Sản phẩm | `Category` | Danh mục (Cà phê, Trà, Sinh tố) |
| | `Food` | Sản phẩm (tên, giá, giảm giá, hình ảnh) |
| | `Size` | Kích cỡ (S, M, L) |
| | `Topping` | Topping bổ sung |
| Kho | `Ingredient` | Nguyên liệu |
| | `FoodIngredient` | Công thức (món ↔ nguyên liệu) |
| | `Warehouse` | Tồn kho nguyên liệu |
| Giỏ hàng | `GioHang` | Giỏ hàng của user |
| | `GioHang_Topping` | Topping trong giỏ hàng |
| Đơn hàng | `Orders` | Đơn hàng |
| | `OrderDetails` | Chi tiết đơn hàng |
| | `OrderDetail_Toppings` | Topping trong đơn hàng |
| Thanh toán | `PhuongThucThanhToan` | Phương thức (COD, VNPAY) |
| | `OrderStatus` | Trạng thái đơn hàng |
| | `Vouchers` | Mã giảm giá |
| Tại quán | `TableFood` | Quản lý bàn |
| | `Invoice` / `InvoiceDetail` | Hóa đơn tại quán |

---

## 🚀 Hướng dẫn cài đặt & chạy

### Yêu cầu

- **Node.js** >= 18
- **MySQL** >= 8.0
- **Expo CLI** — `npm install -g expo-cli`
- **Expo Go** app trên điện thoại (Android/iOS)

### 1. Clone dự án

```bash
git clone https://github.com/Nhantoetsocute/QLDU.git
cd QLDU
```

### 2. Tạo Database

```bash
mysql -u root -p < database/QuanLyBanNuoc.sql
```

### 3. Cấu hình Backend

```bash
cd backend
npm install
```

Tạo file `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=QuanLyBanNuoc
```

### 4. Chạy Backend

```bash
node server.js
```

### 5. Cài đặt & chạy Frontend

```bash
cd ..
npm install
npm start
```

Quét mã QR bằng **Expo Go** trên điện thoại để mở ứng dụng.

---

## 📄 License

Dự án phục vụ mục đích học tập.
