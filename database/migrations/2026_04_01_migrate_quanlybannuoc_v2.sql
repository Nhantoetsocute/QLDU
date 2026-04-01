-- =============================================
-- Migration: QuanLyBanNuoc v2
-- Mục tiêu:
-- 1) Bỏ trigger sinh mã (tránh lỗi MySQL 1442)
-- 2) Chuẩn hóa topping đơn hàng: OrderDetail_Toppings (many-to-many)
-- 3) Snapshot địa chỉ giao hàng vào Orders
-- 4) Chuẩn hóa mã quản lý NOT NULL + unique
-- MySQL 8+
-- =============================================

USE QuanLyBanNuoc;

-- ---------------------------------------------
-- A) Drop trigger cũ (nếu có)
-- ---------------------------------------------
DROP TRIGGER IF EXISTS trg_users_code_after_insert;
DROP TRIGGER IF EXISTS trg_orders_code_after_insert;
DROP TRIGGER IF EXISTS trg_invoice_code_after_insert;

-- ---------------------------------------------
-- B) Chuẩn hóa cột code
-- ---------------------------------------------
ALTER TABLE Users   ADD COLUMN IF NOT EXISTS UserCode VARCHAR(20) NULL AFTER UserId;
ALTER TABLE Orders  ADD COLUMN IF NOT EXISTS OrderCode VARCHAR(30) NULL AFTER OrderId;
ALTER TABLE Invoice ADD COLUMN IF NOT EXISTS InvoiceCode VARCHAR(30) NULL AFTER InvoiceId;

-- Backfill code cho dữ liệu cũ (nếu thiếu)
UPDATE Users
SET UserCode = CONCAT('USR', LPAD(UserId, 8, '0'))
WHERE UserCode IS NULL OR UserCode = '';

UPDATE Orders
SET OrderCode = CONCAT('ORD', DATE_FORMAT(COALESCE(OrderDate, CURRENT_TIMESTAMP), '%y%m%d'), LPAD(OrderId, 6, '0'))
WHERE OrderCode IS NULL OR OrderCode = '';

UPDATE Invoice
SET InvoiceCode = CONCAT('INV', DATE_FORMAT(COALESCE(DateCheckIn, CURRENT_TIMESTAMP), '%y%m%d'), LPAD(InvoiceId, 6, '0'))
WHERE InvoiceCode IS NULL OR InvoiceCode = '';

-- Chuyển sang NOT NULL
ALTER TABLE Users   MODIFY COLUMN UserCode VARCHAR(20) NOT NULL;
ALTER TABLE Orders  MODIFY COLUMN OrderCode VARCHAR(30) NOT NULL;
ALTER TABLE Invoice MODIFY COLUMN InvoiceCode VARCHAR(30) NOT NULL;

-- Tạo unique index nếu thiếu
SET @idx_count := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users' AND INDEX_NAME = 'UK_Users_UserCode'
);
SET @sql := IF(@idx_count = 0,
  'CREATE UNIQUE INDEX UK_Users_UserCode ON Users(UserCode)',
  'SELECT "UK_Users_UserCode exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_count := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Orders' AND INDEX_NAME = 'UK_Orders_OrderCode'
);
SET @sql := IF(@idx_count = 0,
  'CREATE UNIQUE INDEX UK_Orders_OrderCode ON Orders(OrderCode)',
  'SELECT "UK_Orders_OrderCode exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_count := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Invoice' AND INDEX_NAME = 'UK_Invoice_Code'
);
SET @sql := IF(@idx_count = 0,
  'CREATE UNIQUE INDEX UK_Invoice_Code ON Invoice(InvoiceCode)',
  'SELECT "UK_Invoice_Code exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------
-- C) Snapshot địa chỉ giao hàng vào Orders
-- ---------------------------------------------
ALTER TABLE Orders ADD COLUMN IF NOT EXISTS ReceiverName VARCHAR(120) NULL AFTER VoucherId;
ALTER TABLE Orders ADD COLUMN IF NOT EXISTS ReceiverPhone VARCHAR(20) NULL AFTER ReceiverName;
ALTER TABLE Orders ADD COLUMN IF NOT EXISTS DeliveryAddress VARCHAR(255) NULL AFTER ReceiverPhone;

-- Nếu schema cũ có DeliveryAddressId: copy dữ liệu từ DeliveryAddresses
UPDATE Orders o
LEFT JOIN DeliveryAddresses da ON da.AddressId = o.DeliveryAddressId
LEFT JOIN Users u ON u.UserId = o.UserId
SET
  o.ReceiverName = COALESCE(NULLIF(o.ReceiverName, ''), da.ReceiverName, u.UserName, 'Khách hàng'),
  o.ReceiverPhone = COALESCE(NULLIF(o.ReceiverPhone, ''), da.Phone, u.Phone, 'Chưa có số'),
  o.DeliveryAddress = COALESCE(NULLIF(o.DeliveryAddress, ''), da.AddressLine, u.Address, 'Chưa có địa chỉ')
WHERE
  (o.ReceiverName IS NULL OR o.ReceiverName = ''
   OR o.ReceiverPhone IS NULL OR o.ReceiverPhone = ''
   OR o.DeliveryAddress IS NULL OR o.DeliveryAddress = '');

-- Nếu vẫn thiếu thì set fallback cứng để chuyển NOT NULL an toàn
UPDATE Orders
SET ReceiverName = COALESCE(NULLIF(ReceiverName, ''), 'Khách hàng')
WHERE ReceiverName IS NULL OR ReceiverName = '';

UPDATE Orders
SET ReceiverPhone = COALESCE(NULLIF(ReceiverPhone, ''), 'Chưa có số')
WHERE ReceiverPhone IS NULL OR ReceiverPhone = '';

UPDATE Orders
SET DeliveryAddress = COALESCE(NULLIF(DeliveryAddress, ''), 'Chưa có địa chỉ')
WHERE DeliveryAddress IS NULL OR DeliveryAddress = '';

ALTER TABLE Orders MODIFY COLUMN ReceiverName VARCHAR(120) NOT NULL;
ALTER TABLE Orders MODIFY COLUMN ReceiverPhone VARCHAR(20) NOT NULL;
ALTER TABLE Orders MODIFY COLUMN DeliveryAddress VARCHAR(255) NOT NULL;

-- Drop FK + cột DeliveryAddressId nếu còn
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Orders'
    AND CONSTRAINT_NAME = 'FK_Orders_DeliveryAddress'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0,
  'ALTER TABLE Orders DROP FOREIGN KEY FK_Orders_DeliveryAddress',
  'SELECT "FK_Orders_DeliveryAddress not found"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE Orders DROP COLUMN IF EXISTS DeliveryAddressId;

-- ---------------------------------------------
-- D) Topping nhiều-nhiều cho OrderDetails
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS OrderDetail_Toppings (
  Id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  OrderDetailId BIGINT UNSIGNED NOT NULL,
  ToppingId BIGINT UNSIGNED NOT NULL,
  Quantity INT UNSIGNED NOT NULL DEFAULT 1,
  Price DECIMAL(12,2) NOT NULL,
  CONSTRAINT FK_ODT_OrderDetails FOREIGN KEY (OrderDetailId)
    REFERENCES OrderDetails(OrderDetailId) ON DELETE CASCADE,
  CONSTRAINT FK_ODT_Topping FOREIGN KEY (ToppingId)
    REFERENCES Topping(ToppingId) ON DELETE RESTRICT,
  UNIQUE KEY UK_ODT_Unique (OrderDetailId, ToppingId),
  KEY IDX_ODT_OrderDetailId (OrderDetailId),
  KEY IDX_ODT_ToppingId (ToppingId)
) ENGINE=InnoDB;

-- Nếu schema cũ có OrderDetails.ToppingId thì migrate sang OrderDetail_Toppings
INSERT INTO OrderDetail_Toppings (OrderDetailId, ToppingId, Quantity, Price)
SELECT od.OrderDetailId, od.ToppingId, 1, COALESCE(t.Price, 0)
FROM OrderDetails od
JOIN Topping t ON t.ToppingId = od.ToppingId
LEFT JOIN OrderDetail_Toppings odt
  ON odt.OrderDetailId = od.OrderDetailId AND odt.ToppingId = od.ToppingId
WHERE od.ToppingId IS NOT NULL
  AND odt.Id IS NULL;

-- Drop FK + cột ToppingId cũ nếu còn
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'OrderDetails'
    AND CONSTRAINT_NAME = 'FK_OrderDetails_Topping'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0,
  'ALTER TABLE OrderDetails DROP FOREIGN KEY FK_OrderDetails_Topping',
  'SELECT "FK_OrderDetails_Topping not found"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE OrderDetails DROP COLUMN IF EXISTS ToppingId;

-- ---------------------------------------------
-- E) Thông báo quy ước
-- ---------------------------------------------
SELECT 'Migration completed. Sinh mã UserCode/OrderCode/InvoiceCode ở Backend trước khi INSERT.' AS message;
