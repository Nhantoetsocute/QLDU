-- =============================================
-- DATABASE: QuanLyBanNuoc
-- Ứng dụng quản lý bán nước (React Native + Express + MySQL)
-- Chức năng: đăng ký/đăng nhập, danh mục/món, giỏ hàng,
--   đơn hàng, voucher, COD/VNPay, thông báo, bàn tại quán,
--   hóa đơn, kho nguyên liệu.
-- Tương thích: MySQL 8+
-- Ngày tạo: 21/04/2026
-- =============================================

DROP DATABASE IF EXISTS QuanLyBanNuoc;

CREATE DATABASE QuanLyBanNuoc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE QuanLyBanNuoc;

SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- Lưu ý quan trọng:
-- • UserCode / OrderCode / InvoiceCode do Backend sinh trước khi INSERT
--   (không dùng trigger UPDATE chính bảng — tránh lỗi MySQL 1442).
-- • Giỏ hàng (GioHang) hỗ trợ Size & Topping nhưng backend hiện tại
--   chưa sử dụng SizeId/Topping trong cart flow.
-- • DeliveryAddresses giữ lại cho mở rộng; đơn hàng snapshot địa chỉ
--   trực tiếp vào bảng Orders.


-- =========================================================
-- 1) NGƯỜI DÙNG & OTP
-- =========================================================

CREATE TABLE IF NOT EXISTS Users (
  UserId        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserCode      VARCHAR(20)   NOT NULL             COMMENT 'Mã user: USR + LPAD(UserId,8,0) — backend sinh',
  UserName      VARCHAR(120)  NOT NULL             COMMENT 'Tên hiển thị',
  Email         VARCHAR(190)  NOT NULL             COMMENT 'Email đăng nhập (unique, lowercase)',
  PasswordHash  VARCHAR(255)  NOT NULL             COMMENT 'Bcrypt hash',
  Phone         VARCHAR(20)   NULL                 COMMENT 'Số điện thoại',
  Address       VARCHAR(255)  NULL                 COMMENT 'Địa chỉ mặc định',
  AvatarUrl     VARCHAR(500)  NULL                 COMMENT 'Đường dẫn tương đối, VD: /avatars/abc.jpg',
  OTPCode       VARCHAR(10)   NULL                 COMMENT 'Mã OTP (quên mật khẩu)',
  OTPExpiry     DATETIME      NULL                 COMMENT 'Thời gian hết hạn OTP',
  IsActive      TINYINT(1)    NOT NULL DEFAULT 1   COMMENT '1=hoạt động, 0=bị khóa',
  CreatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY UK_Users_UserCode (UserCode),
  UNIQUE KEY UK_Users_Email    (Email),
  UNIQUE KEY UK_Users_Phone    (Phone)
) ENGINE=InnoDB COMMENT='Bảng người dùng — dùng trong authController, userController';


-- Sổ địa chỉ giao hàng (dự phòng mở rộng)
CREATE TABLE IF NOT EXISTS DeliveryAddresses (
  AddressId     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId        BIGINT UNSIGNED NOT NULL,
  ReceiverName  VARCHAR(120)    NOT NULL,
  Phone         VARCHAR(20)     NOT NULL,
  AddressLine   VARCHAR(255)    NOT NULL,
  IsDefault     TINYINT(1)      NOT NULL DEFAULT 0,
  CreatedAt     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT FK_DeliveryAddresses_Users FOREIGN KEY (UserId)
    REFERENCES Users(UserId) ON DELETE CASCADE,
  KEY IDX_DeliveryAddresses_UserId (UserId)
) ENGINE=InnoDB COMMENT='Sổ địa chỉ (dự phòng — đơn hàng hiện snapshot vào Orders)';


-- =========================================================
-- 2) DANH MỤC — MÓN — SIZE — TOPPING
-- =========================================================

CREATE TABLE IF NOT EXISTS Category (
  CategoryId    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  CategoryName  VARCHAR(120)  NOT NULL,
  ImageUrl      VARCHAR(500)  NULL                 COMMENT 'Ảnh danh mục (tuỳ chọn)',
  IsActive      TINYINT(1)    NOT NULL DEFAULT 1,
  CreatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY UK_Category_Name (CategoryName)
) ENGINE=InnoDB COMMENT='Danh mục món — dùng trong foodController';


CREATE TABLE IF NOT EXISTS Size (
  SizeId      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  SizeName    VARCHAR(50)    NOT NULL,
  ExtraPrice  DECIMAL(12,2)  NOT NULL DEFAULT 0    COMMENT 'Phụ thu khi chọn size',
  IsActive    TINYINT(1)     NOT NULL DEFAULT 1,

  UNIQUE KEY UK_Size_Name (SizeName)
) ENGINE=InnoDB COMMENT='Size đồ uống (S/M/L)';


CREATE TABLE IF NOT EXISTS Food (
  FoodId          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  FoodName        VARCHAR(150)    NOT NULL,
  CategoryId      BIGINT UNSIGNED NOT NULL,
  BasePrice       DECIMAL(12,2)   NOT NULL           COMMENT 'Giá gốc',
  DiscountPercent DECIMAL(5,2)    NOT NULL DEFAULT 0  COMMENT '% giảm giá',
  Stock           INT UNSIGNED    NOT NULL DEFAULT 0  COMMENT 'Tồn kho',
  ImageUrl        VARCHAR(500)    NULL                COMMENT 'Đường dẫn ảnh sản phẩm',
  Description     TEXT            NULL,
  IsActive        TINYINT(1)      NOT NULL DEFAULT 1,
  CreatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT FK_Food_Category FOREIGN KEY (CategoryId)
    REFERENCES Category(CategoryId) ON DELETE RESTRICT,
  KEY IDX_Food_CategoryId (CategoryId),
  KEY IDX_Food_IsActive   (IsActive)
) ENGINE=InnoDB COMMENT='Món ăn / đồ uống — dùng trong foodController, cartController, orderController';


CREATE TABLE IF NOT EXISTS Topping (
  ToppingId    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ToppingName  VARCHAR(120)    NOT NULL,
  Price        DECIMAL(12,2)   NOT NULL DEFAULT 0,
  IsActive     TINYINT(1)      NOT NULL DEFAULT 1,
  CreatedAt    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY UK_Topping_Name (ToppingName)
) ENGINE=InnoDB COMMENT='Topping (trân châu, thạch, kem phô mai…)';


-- =========================================================
-- 3) KHO — NGUYÊN LIỆU
-- =========================================================

CREATE TABLE IF NOT EXISTS Ingredient (
  IngredientId    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  IngredientName  VARCHAR(120)  NOT NULL,
  Unit            VARCHAR(20)   NOT NULL DEFAULT 'g'  COMMENT 'Đơn vị: g, ml, cái…',
  IsActive        TINYINT(1)    NOT NULL DEFAULT 1,
  CreatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY UK_Ingredient_Name (IngredientName)
) ENGINE=InnoDB COMMENT='Danh sách nguyên liệu';


CREATE TABLE IF NOT EXISTS FoodIngredient (
  FoodIngredientId  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  FoodId            BIGINT UNSIGNED NOT NULL,
  IngredientId      BIGINT UNSIGNED NOT NULL,
  QuantityRequired  DECIMAL(12,3)   NOT NULL           COMMENT 'Lượng nguyên liệu cần cho 1 phần',

  CONSTRAINT FK_FoodIngredient_Food FOREIGN KEY (FoodId)
    REFERENCES Food(FoodId) ON DELETE CASCADE,
  CONSTRAINT FK_FoodIngredient_Ingredient FOREIGN KEY (IngredientId)
    REFERENCES Ingredient(IngredientId) ON DELETE RESTRICT,
  UNIQUE  KEY UK_FoodIngredient_Unique       (FoodId, IngredientId),
  KEY         IDX_FoodIngredient_FoodId      (FoodId),
  KEY         IDX_FoodIngredient_IngredientId(IngredientId)
) ENGINE=InnoDB COMMENT='Liên kết món ↔ nguyên liệu (many-to-many)';


CREATE TABLE IF NOT EXISTS Warehouse (
  WarehouseId   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  IngredientId  BIGINT UNSIGNED NOT NULL,
  StockQty      DECIMAL(12,3)   NOT NULL DEFAULT 0    COMMENT 'Số lượng tồn kho',
  LastUpdated   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT FK_Warehouse_Ingredient FOREIGN KEY (IngredientId)
    REFERENCES Ingredient(IngredientId) ON DELETE RESTRICT,
  UNIQUE KEY UK_Warehouse_Ingredient (IngredientId)
) ENGINE=InnoDB COMMENT='Kho nguyên liệu';


-- =========================================================
-- 4) GIỎ HÀNG
-- =========================================================

CREATE TABLE IF NOT EXISTS GioHang (
  GioHangId   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId      BIGINT UNSIGNED NOT NULL,
  FoodId      BIGINT UNSIGNED NOT NULL,
  SizeId      BIGINT UNSIGNED NULL                    COMMENT 'Size (tuỳ chọn, dự phòng)',
  Quantity    INT UNSIGNED    NOT NULL DEFAULT 1,
  CreatedAt   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT FK_GioHang_Users FOREIGN KEY (UserId)
    REFERENCES Users(UserId) ON DELETE CASCADE,
  CONSTRAINT FK_GioHang_Food  FOREIGN KEY (FoodId)
    REFERENCES Food(FoodId)  ON DELETE RESTRICT,
  CONSTRAINT FK_GioHang_Size  FOREIGN KEY (SizeId)
    REFERENCES Size(SizeId)  ON DELETE SET NULL,
  KEY IDX_GioHang_UserId (UserId),
  KEY IDX_GioHang_FoodId (FoodId)
) ENGINE=InnoDB COMMENT='Giỏ hàng — dùng trong cartController';


CREATE TABLE IF NOT EXISTS GioHang_Topping (
  GioHangToppingId  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  GioHangId         BIGINT UNSIGNED NOT NULL,
  ToppingId         BIGINT UNSIGNED NOT NULL,
  Quantity          INT UNSIGNED    NOT NULL DEFAULT 1,

  CONSTRAINT FK_GioHangTopping_GioHang  FOREIGN KEY (GioHangId)
    REFERENCES GioHang(GioHangId) ON DELETE CASCADE,
  CONSTRAINT FK_GioHangTopping_Topping  FOREIGN KEY (ToppingId)
    REFERENCES Topping(ToppingId) ON DELETE RESTRICT,
  UNIQUE KEY UK_GioHangTopping_Unique (GioHangId, ToppingId)
) ENGINE=InnoDB COMMENT='Topping trong giỏ hàng (dự phòng)';


-- =========================================================
-- 5) PHƯƠNG THỨC THANH TOÁN — TRẠNG THÁI — VOUCHER
-- =========================================================

CREATE TABLE IF NOT EXISTS PhuongThucThanhToan (
  PaymentMethodId  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  TenPhuongThuc    VARCHAR(50)   NOT NULL,
  IsActive         TINYINT(1)    NOT NULL DEFAULT 1,

  UNIQUE KEY UK_PaymentMethod_Name (TenPhuongThuc)
) ENGINE=InnoDB COMMENT='Phương thức thanh toán — COD (id=1), VNPAY (id=2)';


CREATE TABLE IF NOT EXISTS OrderStatus (
  StatusId    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  StatusName  VARCHAR(50) NOT NULL,

  UNIQUE KEY UK_OrderStatus_Name (StatusName)
) ENGINE=InnoDB COMMENT='Trạng thái đơn hàng — preparing(1), shipping(2), completed(3), cancelled(4)';


CREATE TABLE IF NOT EXISTS Vouchers (
  VoucherId           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Code                VARCHAR(60)     NOT NULL           COMMENT 'Mã voucher (uppercase)',
  DiscountAmount      DECIMAL(12,2)   NOT NULL DEFAULT 0 COMMENT 'Giảm cố định (VNĐ)',
  DiscountPercentage  DECIMAL(5,2)    NOT NULL DEFAULT 0 COMMENT 'Giảm theo % (0–100)',
  MinOrderAmount      DECIMAL(12,2)   NOT NULL DEFAULT 0 COMMENT 'Đơn tối thiểu để áp dụng',
  MaxDiscountAmount   DECIMAL(12,2)   NULL               COMMENT 'Mức giảm tối đa khi dùng %',
  UsageLimit          INT UNSIGNED    NULL               COMMENT 'Số lần dùng tối đa (NULL=không giới hạn)',
  UsageCount          INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT 'Đã dùng bao nhiêu lần',
  ExpiryDate          DATETIME        NOT NULL,
  IsActive            TINYINT(1)      NOT NULL DEFAULT 1,
  CreatedAt           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY UK_Vouchers_Code (Code)
) ENGINE=InnoDB COMMENT='Mã giảm giá — dùng trong voucherController';


-- =========================================================
-- 6) ĐƠN HÀNG
-- =========================================================

CREATE TABLE IF NOT EXISTS Orders (
  OrderId          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  OrderCode        VARCHAR(30)     NOT NULL           COMMENT 'Mã đơn: ORD + yymmdd + random',
  UserId           BIGINT UNSIGNED NOT NULL,
  OrderDate        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  TotalAmount      DECIMAL(12,2)   NOT NULL DEFAULT 0 COMMENT 'Tổng tiền sau giảm giá',
  PaymentMethodId  BIGINT UNSIGNED NOT NULL           COMMENT '1=COD, 2=VNPAY',
  StatusId         BIGINT UNSIGNED NOT NULL           COMMENT '1=preparing, 2=shipping, 3=completed, 4=cancelled',
  VoucherId        BIGINT UNSIGNED NULL,
  ReceiverName     VARCHAR(120)    NOT NULL           COMMENT 'Snapshot tên người nhận',
  ReceiverPhone    VARCHAR(20)     NOT NULL           COMMENT 'Snapshot SĐT người nhận',
  DeliveryAddress  VARCHAR(255)    NOT NULL           COMMENT 'Snapshot địa chỉ giao',
  Note             VARCHAR(255)    NULL               COMMENT 'Ghi chú đơn hàng',
  CreatedAt        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT FK_Orders_Users         FOREIGN KEY (UserId)
    REFERENCES Users(UserId) ON DELETE RESTRICT,
  CONSTRAINT FK_Orders_PaymentMethod FOREIGN KEY (PaymentMethodId)
    REFERENCES PhuongThucThanhToan(PaymentMethodId) ON DELETE RESTRICT,
  CONSTRAINT FK_Orders_Status        FOREIGN KEY (StatusId)
    REFERENCES OrderStatus(StatusId) ON DELETE RESTRICT,
  CONSTRAINT FK_Orders_Voucher       FOREIGN KEY (VoucherId)
    REFERENCES Vouchers(VoucherId) ON DELETE SET NULL,

  UNIQUE KEY UK_Orders_OrderCode (OrderCode),
  KEY IDX_Orders_UserId    (UserId),
  KEY IDX_Orders_StatusId  (StatusId),
  KEY IDX_Orders_OrderDate (OrderDate)
) ENGINE=InnoDB COMMENT='Đơn hàng — dùng trong orderController, vnpayController';


CREATE TABLE IF NOT EXISTS OrderDetails (
  OrderDetailId  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  OrderId        BIGINT UNSIGNED NOT NULL,
  FoodId         BIGINT UNSIGNED NOT NULL,
  SizeId         BIGINT UNSIGNED NULL                COMMENT 'Size (dự phòng)',
  Quantity       INT UNSIGNED    NOT NULL DEFAULT 1,
  UnitPrice      DECIMAL(12,2)   NOT NULL            COMMENT 'Giá tại thời điểm đặt',
  LineTotal      DECIMAL(12,2)   NOT NULL            COMMENT 'Quantity × UnitPrice',

  CONSTRAINT FK_OrderDetails_Orders FOREIGN KEY (OrderId)
    REFERENCES Orders(OrderId) ON DELETE CASCADE,
  CONSTRAINT FK_OrderDetails_Food   FOREIGN KEY (FoodId)
    REFERENCES Food(FoodId) ON DELETE RESTRICT,
  CONSTRAINT FK_OrderDetails_Size   FOREIGN KEY (SizeId)
    REFERENCES Size(SizeId) ON DELETE SET NULL,
  KEY IDX_OrderDetails_OrderId (OrderId),
  KEY IDX_OrderDetails_FoodId  (FoodId)
) ENGINE=InnoDB COMMENT='Chi tiết đơn hàng — dùng trong orderController';


CREATE TABLE IF NOT EXISTS OrderDetail_Toppings (
  Id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  OrderDetailId   BIGINT UNSIGNED NOT NULL,
  ToppingId       BIGINT UNSIGNED NOT NULL,
  Quantity        INT UNSIGNED    NOT NULL DEFAULT 1,
  Price           DECIMAL(12,2)   NOT NULL           COMMENT 'Giá topping tại thời điểm đặt',

  CONSTRAINT FK_ODT_OrderDetails FOREIGN KEY (OrderDetailId)
    REFERENCES OrderDetails(OrderDetailId) ON DELETE CASCADE,
  CONSTRAINT FK_ODT_Topping      FOREIGN KEY (ToppingId)
    REFERENCES Topping(ToppingId) ON DELETE RESTRICT,
  UNIQUE KEY UK_ODT_Unique         (OrderDetailId, ToppingId),
  KEY        IDX_ODT_OrderDetailId (OrderDetailId),
  KEY        IDX_ODT_ToppingId     (ToppingId)
) ENGINE=InnoDB COMMENT='Topping trong chi tiết đơn hàng (many-to-many)';


-- =========================================================
-- 7) THÔNG BÁO
-- =========================================================

CREATE TABLE IF NOT EXISTS Notifications (
  NotificationId  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId          BIGINT UNSIGNED NULL                COMMENT 'NULL = thông báo chung cho tất cả user',
  Title           VARCHAR(200)    NOT NULL,
  Body            TEXT            NULL,
  Type            ENUM('order','promotion','system') NOT NULL DEFAULT 'system',
  IsRead          TINYINT(1)      NOT NULL DEFAULT 0,
  RelatedOrderId  BIGINT UNSIGNED NULL                COMMENT 'Liên kết đến đơn hàng (tuỳ chọn)',
  CreatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT FK_Notifications_Users  FOREIGN KEY (UserId)
    REFERENCES Users(UserId) ON DELETE CASCADE,
  CONSTRAINT FK_Notifications_Orders FOREIGN KEY (RelatedOrderId)
    REFERENCES Orders(OrderId) ON DELETE SET NULL,
  KEY IDX_Notifications_UserId    (UserId),
  KEY IDX_Notifications_CreatedAt (CreatedAt)
) ENGINE=InnoDB COMMENT='Thông báo — dùng cho NotificationsScreen';


-- =========================================================
-- 8) BÀN & HÓA ĐƠN TẠI QUÁN
-- =========================================================

CREATE TABLE IF NOT EXISTS TableFood (
  TableId    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  TableName  VARCHAR(50)  NOT NULL,
  Capacity   INT UNSIGNED NOT NULL DEFAULT 2         COMMENT 'Số chỗ ngồi',
  Status     ENUM('available','occupied','reserved')
             NOT NULL DEFAULT 'available',

  UNIQUE KEY UK_TableFood_TableName (TableName)
) ENGINE=InnoDB COMMENT='Bàn tại quán';


CREATE TABLE IF NOT EXISTS Invoice (
  InvoiceId     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  InvoiceCode   VARCHAR(30)     NOT NULL             COMMENT 'Mã hóa đơn: INV + yymmdd + sequence',
  TableId       BIGINT UNSIGNED NOT NULL,
  OrderId       BIGINT UNSIGNED NULL                 COMMENT 'Liên kết đơn online (tuỳ chọn)',
  DateCheckIn   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  DateCheckOut  DATETIME        NULL,
  TotalAmount   DECIMAL(12,2)   NOT NULL DEFAULT 0,
  CreatedAt     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT FK_Invoice_TableFood FOREIGN KEY (TableId)
    REFERENCES TableFood(TableId) ON DELETE RESTRICT,
  CONSTRAINT FK_Invoice_Orders    FOREIGN KEY (OrderId)
    REFERENCES Orders(OrderId) ON DELETE SET NULL,
  UNIQUE KEY UK_Invoice_Code    (InvoiceCode),
  KEY        IDX_Invoice_TableId(TableId)
) ENGINE=InnoDB COMMENT='Hóa đơn tại quán';


CREATE TABLE IF NOT EXISTS InvoiceDetail (
  InvoiceDetailId  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  InvoiceId        BIGINT UNSIGNED NOT NULL,
  FoodId           BIGINT UNSIGNED NOT NULL,
  Quantity         INT UNSIGNED    NOT NULL DEFAULT 1,
  UnitPrice        DECIMAL(12,2)   NOT NULL,
  LineTotal        DECIMAL(12,2)   NOT NULL,

  CONSTRAINT FK_InvoiceDetail_Invoice FOREIGN KEY (InvoiceId)
    REFERENCES Invoice(InvoiceId) ON DELETE CASCADE,
  CONSTRAINT FK_InvoiceDetail_Food    FOREIGN KEY (FoodId)
    REFERENCES Food(FoodId) ON DELETE RESTRICT,
  KEY IDX_InvoiceDetail_InvoiceId (InvoiceId)
) ENGINE=InnoDB COMMENT='Chi tiết hóa đơn tại quán';


-- =========================================================
-- 9) QUY ƯỚC SINH MÃ (xử lý ở Backend — KHÔNG dùng trigger)
-- =========================================================
-- Users.UserCode      : 'USR' + LPAD(UserId, 8, '0')    → VD: USR00000001
-- Orders.OrderCode    : 'ORD' + yymmdd + random(4 chữ số) → VD: ORD2604211234
-- Invoice.InvoiceCode : 'INV' + yymmdd + sequence         → VD: INV260421001


-- =========================================================
-- 10) DỮ LIỆU SEED CƠ BẢN
-- =========================================================

-- ── Phương thức thanh toán ──
INSERT INTO PhuongThucThanhToan (PaymentMethodId, TenPhuongThuc)
VALUES (1, 'COD'), (2, 'VNPAY')
ON DUPLICATE KEY UPDATE TenPhuongThuc = VALUES(TenPhuongThuc);

-- ── Trạng thái đơn hàng ──
INSERT INTO OrderStatus (StatusId, StatusName)
VALUES (1, 'preparing'), (2, 'shipping'), (3, 'completed'), (4, 'cancelled')
ON DUPLICATE KEY UPDATE StatusName = VALUES(StatusName);

-- ── Size đồ uống ──
INSERT INTO Size (SizeName, ExtraPrice)
VALUES ('S', 0), ('M', 5000), ('L', 10000)
ON DUPLICATE KEY UPDATE ExtraPrice = VALUES(ExtraPrice);

-- ── Danh mục (đồng bộ với seed_food.js) ──
INSERT INTO Category (CategoryId, CategoryName) VALUES
  (1, 'Cà phê'),
  (2, 'Trà'),
  (3, 'Sinh tố'),
  (4, 'Nước ép'),
  (5, 'Sữa'),
  (6, 'Giải khát'),
  (7, 'Dinh dưỡng')
ON DUPLICATE KEY UPDATE CategoryName = VALUES(CategoryName);

-- ── Topping ──
INSERT INTO Topping (ToppingName, Price) VALUES
  ('Trân châu đen',   5000),
  ('Trân châu trắng', 5000),
  ('Thạch dừa',       5000),
  ('Thạch trái cây',  7000),
  ('Kem phô mai',    10000),
  ('Shot espresso',   10000),
  ('Pudding trứng',   8000),
  ('Sương sáo',       5000)
ON DUPLICATE KEY UPDATE Price = VALUES(Price);

-- ══════════════════════════════════════════════════════════════
-- Sản phẩm — Đồng bộ với HomeScreen & AllProductsScreen
-- (FoodId cố định để khớp với frontend)
-- ══════════════════════════════════════════════════════════════

INSERT INTO Food (FoodId, FoodName, CategoryId, BasePrice, DiscountPercent, Stock, ImageUrl, Description) VALUES
  (1,  'Nước ép rau má',        4, 120000, 0, 100, '/images/rauma.jpg',       'Rau má tươi xay lạnh cùng chút đường phèn thanh nhẹ, giúp giải nhiệt và làm dịu cơ thể trong ngày nắng.'),
  (2,  'Trà đào cam sả',       2,  55000, 0, 100, '/images/tra_cam_xa.jpg',  'Sự kết hợp của trà đen ủ đậm, đào ngọt dịu, cam mọng nước và hương sả thơm mát, cân bằng chua ngọt.'),
  (3,  'Trà Chanh',             2,  35000, 0, 100, '/images/tra_chanh.webp',  'Vị trà thanh nhẹ hòa cùng chanh tươi và đá lạnh, mang cảm giác sảng khoái tức thì.'),
  (4,  'Trà Xanh',              2,  40000, 0, 100, '/images/tra_xanh.jpg',    'Trà xanh nguyên lá với hậu vị dịu và hương thơm tự nhiên, phù hợp cho người thích vị trà thuần khiết.'),
  (5,  'Cà phê sữa đá',        1,  29000, 0, 100, '/images/CPSD.webp',       'Cà phê pha phin truyền thống thơm lừng kết hợp cùng sữa đặc béo ngậy.'),
  (6,  'Nước Ion Kiềm Cao Cấp', 7,  25000, 0, 200, '/images/ion.png',         'Nước ion kiềm tinh lọc với vị mềm nhẹ, hỗ trợ bù khoáng và làm dịu cơ thể sau vận động.'),
  (7,  'Soda Mix Dâu Rừng',     6,  45000, 0, 100, '/images/soda.jpg',        'Soda mát lạnh kết hợp siro dâu rừng thơm ngọt, tạo cảm giác sủi tê vui miệng và trẻ trung.'),
  (8,  'Sữa Hạnh Nhân Organic', 5,  65000, 0,  80, '/images/sua.jpg',         'Sữa hạnh nhân nguyên chất, béo nhẹ tự nhiên, không ngấy, phù hợp cho lối sống lành mạnh.'),
  (9,  'Nước Ép Cam Tươi',      4,  55000, 0, 100, '/images/cam.png',         'Cam tươi ép tại quầy giữ trọn vị chua ngọt tự nhiên và hương thơm mọng nước giàu vitamin C.'),
  (10, 'Protein Shake Socola',  7,  85000, 0,  50, '/images/protein.jpeg',    'Protein shake vị socola đậm đà, tăng năng lượng nhanh, thích hợp trước hoặc sau khi tập luyện.'),
  (11, 'Nước Ép Nhãn Lồng',    4,  60000, 0,  80, '/images/nhan.jpg',        'Nhãn lồng Hưng Yên ép tươi ngọt thanh, mát lành, bổ dưỡng.')
ON DUPLICATE KEY UPDATE
  FoodName = VALUES(FoodName),
  BasePrice = VALUES(BasePrice),
  Stock = VALUES(Stock),
  Description = VALUES(Description),
  ImageUrl = VALUES(ImageUrl);

-- ── Voucher mẫu ──
INSERT INTO Vouchers (Code, DiscountAmount, DiscountPercentage, MinOrderAmount, ExpiryDate) VALUES
  ('WELCOME10',  0,     10,  50000,   '2026-12-31 23:59:59'),
  ('GIAM20K',    20000,  0,  100000,  '2026-12-31 23:59:59'),
  ('FREESHIP',   15000,  0,  0,       '2026-06-30 23:59:59'),
  ('SUMMER25',   0,     25,  80000,   '2026-08-31 23:59:59')
ON DUPLICATE KEY UPDATE DiscountAmount = VALUES(DiscountAmount);

-- ── Bàn mẫu ──
INSERT INTO TableFood (TableName, Capacity) VALUES
  ('Bàn 1',  2),
  ('Bàn 2',  2),
  ('Bàn 3',  4),
  ('Bàn 4',  4),
  ('Bàn 5',  6),
  ('Bàn 6',  6),
  ('Bàn VIP 1', 8),
  ('Bàn VIP 2', 10)
ON DUPLICATE KEY UPDATE Capacity = VALUES(Capacity);


-- =========================================================
-- HOÀN TẤT
-- =========================================================
SELECT 'QuanLyBanNuoc database created successfully!' AS Message;
