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

-- ── Danh mục ──
INSERT INTO Category (CategoryName) VALUES
  ('Cà phê'),
  ('Trà sữa'),
  ('Trà trái cây'),
  ('Sinh tố'),
  ('Nước ép'),
  ('Đá xay'),
  ('Topping & Snack')
ON DUPLICATE KEY UPDATE CategoryName = VALUES(CategoryName);

-- ── Topping ──
INSERT INTO Topping (ToppingName, Price) VALUES
  ('Trân châu đen',  5000),
  ('Trân châu trắng', 5000),
  ('Thạch dừa',       5000),
  ('Thạch trái cây',  7000),
  ('Kem phô mai',    10000),
  ('Shot espresso',   10000),
  ('Pudding trứng',   8000),
  ('Sương sáo',       5000)
ON DUPLICATE KEY UPDATE Price = VALUES(Price);

-- ── Sản phẩm mẫu: Cà phê ──
INSERT INTO Food (FoodName, CategoryId, BasePrice, DiscountPercent, Stock, ImageUrl, Description) VALUES
  ('Cà phê sữa đá',     1, 29000, 0,  100, '/images/foods/ca-phe-sua-da.jpg',     'Cà phê phin truyền thống pha với sữa đặc và đá'),
  ('Cà phê đen đá',     1, 25000, 0,  100, '/images/foods/ca-phe-den-da.jpg',     'Cà phê đen nguyên chất, đá viên mát lạnh'),
  ('Bạc xỉu',           1, 29000, 0,  100, '/images/foods/bac-xiu.jpg',           'Nhiều sữa, ít cà phê — vị nhẹ nhàng'),
  ('Americano',          1, 39000, 0,  100, '/images/foods/americano.jpg',         'Espresso pha nước — thanh nhẹ kiểu Ý'),
  ('Latte',              1, 45000, 10, 100, '/images/foods/latte.jpg',             'Espresso + sữa tươi nóng, foam mịn'),
  ('Cappuccino',         1, 45000, 0,  100, '/images/foods/cappuccino.jpg',        'Espresso + foam sữa dày — đậm đà')
ON DUPLICATE KEY UPDATE BasePrice = VALUES(BasePrice);

-- ── Sản phẩm mẫu: Trà sữa ──
INSERT INTO Food (FoodName, CategoryId, BasePrice, DiscountPercent, Stock, ImageUrl, Description) VALUES
  ('Trà sữa trân châu',       2, 35000, 0,  100, '/images/foods/tra-sua-tran-chau.jpg',       'Trà sữa truyền thống kèm trân châu đen'),
  ('Trà sữa matcha',          2, 39000, 0,  100, '/images/foods/tra-sua-matcha.jpg',          'Matcha Nhật Bản hòa quyện sữa tươi'),
  ('Trà sữa khoai môn',       2, 39000, 5,  100, '/images/foods/tra-sua-khoai-mon.jpg',       'Khoai môn tím béo ngậy, thơm lừng'),
  ('Trà sữa socola',          2, 39000, 0,  100, '/images/foods/tra-sua-socola.jpg',          'Socola đậm mix sữa tươi')
ON DUPLICATE KEY UPDATE BasePrice = VALUES(BasePrice);

-- ── Sản phẩm mẫu: Trà trái cây ──
INSERT INTO Food (FoodName, CategoryId, BasePrice, DiscountPercent, Stock, ImageUrl, Description) VALUES
  ('Trà đào cam sả',          3, 39000, 0,  100, '/images/foods/tra-dao-cam-sa.jpg',          'Trà đào thơm mát, cam tươi, sả thơm'),
  ('Trà vải lychee',          3, 35000, 0,  100, '/images/foods/tra-vai-lychee.jpg',          'Trà xanh thanh mát vị vải tự nhiên'),
  ('Trà chanh leo',           3, 35000, 0,  100, '/images/foods/tra-chanh-leo.jpg',           'Trà xanh chua ngọt chanh leo tươi'),
  ('Hồng trà chanh mật ong',  3, 39000, 0,  100, '/images/foods/hong-tra-chanh-mat-ong.jpg',  'Hồng trà + chanh tươi + mật ong')
ON DUPLICATE KEY UPDATE BasePrice = VALUES(BasePrice);

-- ── Sản phẩm mẫu: Sinh tố ──
INSERT INTO Food (FoodName, CategoryId, BasePrice, DiscountPercent, Stock, ImageUrl, Description) VALUES
  ('Sinh tố bơ',              4, 39000, 0,  100, '/images/foods/sinh-to-bo.jpg',              'Bơ sáp béo ngậy xay nhuyễn mịn'),
  ('Sinh tố xoài',            4, 35000, 0,  100, '/images/foods/sinh-to-xoai.jpg',            'Xoài cát Hòa Lộc ngọt tự nhiên'),
  ('Sinh tố dâu',             4, 39000, 10, 100, '/images/foods/sinh-to-dau.jpg',             'Dâu tây tươi xay cùng sữa chua')
ON DUPLICATE KEY UPDATE BasePrice = VALUES(BasePrice);

-- ── Sản phẩm mẫu: Nước ép ──
INSERT INTO Food (FoodName, CategoryId, BasePrice, DiscountPercent, Stock, ImageUrl, Description) VALUES
  ('Nước ép cam',             5, 35000, 0,  100, '/images/foods/nuoc-ep-cam.jpg',             'Cam tươi ép nguyên chất 100%'),
  ('Nước ép dưa hấu',        5, 29000, 0,  100, '/images/foods/nuoc-ep-dua-hau.jpg',        'Dưa hấu tươi mát giải nhiệt'),
  ('Nước ép cà rốt',         5, 29000, 0,  100, '/images/foods/nuoc-ep-ca-rot.jpg',         'Cà rốt tươi bổ dưỡng')
ON DUPLICATE KEY UPDATE BasePrice = VALUES(BasePrice);

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
