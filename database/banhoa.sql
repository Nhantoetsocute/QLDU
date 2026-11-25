-- ============================================================================
-- CƠ SỞ DỮ LIỆU HỆ THỐNG BÁN HOA TÍCH HỢP NHẬN DIỆN AI (SVM - 5 LOÀI HOA)
-- Chuẩn đặt tên: camelCase | Bảng mã: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS quanLyBanHoa
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE quanLyBanHoa;

-- ----------------------------------------------------------------------------
-- 1. Bảng nguoiDung: Quản lý tài khoản Quản trị viên (Admin) & Khách hàng (User)
-- ----------------------------------------------------------------------------
CREATE TABLE nguoiDung (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hoTen VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    matKhau VARCHAR(255) NOT NULL,
    soDienThoai VARCHAR(20) NULL,
    diaChi TEXT NULL,
    vaiTro ENUM('khachHang', 'quanTriVien') NOT NULL DEFAULT 'khachHang',
    trangThai TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Bị khóa',
    ngayTao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ngayCapNhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Bảng sanPhamHoa: Danh mục bó hoa & Ánh xạ 5 nhãn lớp của mô hình SVM
-- ----------------------------------------------------------------------------
CREATE TABLE sanPhamHoa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenSanPham VARCHAR(150) NOT NULL,
    nhanAi ENUM('cucHoaMi', 'boCongAnh', 'hoaHong', 'huongDuong', 'tulip') NOT NULL,
    tenLoaiHoa VARCHAR(100) NOT NULL,
    giaBan DECIMAL(12, 2) NOT NULL,
    soLuongTon INT NOT NULL DEFAULT 0,
    moTa TEXT NULL,
    hinhAnh VARCHAR(255) NULL,
    dangMoBan TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: Đang mở bán, 0: Tạm ẩn/Ngừng bán',
    daXoa TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Chưa xóa, 1: Đã xóa mềm bởi Admin',
    nguoiTaoId INT NULL,
    ngayTao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ngayCapNhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fkHoaNguoiTao FOREIGN KEY (nguoiTaoId) REFERENCES nguoiDung(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Chỉ mục tối ưu truy vấn tìm hoa theo nhãn SVM và lọc sản phẩm hiển thị
CREATE INDEX idxHoaNhanAi ON sanPhamHoa(nhanAi);
CREATE INDEX idxHoaHienThi ON sanPhamHoa(dangMoBan, daXoa);

-- ----------------------------------------------------------------------------
-- 3. Bảng donHang: Lưu thông tin đơn đặt hàng, thanh toán và trạng thái xử lý
-- ----------------------------------------------------------------------------
CREATE TABLE donHang (
    id INT AUTO_INCREMENT PRIMARY KEY,
    maDonHang VARCHAR(30) NOT NULL UNIQUE,
    nguoiDungId INT NOT NULL,
    tenNguoiNhan VARCHAR(100) NOT NULL,
    sdtNguoiNhan VARCHAR(20) NOT NULL,
    diaChiGiao TEXT NOT NULL,
    ghiChu TEXT NULL,
    tongTien DECIMAL(12, 2) NOT NULL,
    phuongThucThanhToan ENUM('tienMat', 'chuyenKhoan') NOT NULL DEFAULT 'tienMat',
    trangThaiThanhToan ENUM('chuaThanhToan', 'daThanhToan') NOT NULL DEFAULT 'chuaThanhToan',
    trangThai ENUM('choXacNhan', 'daXacNhan', 'dangGiao', 'hoanThanh', 'daHuy') NOT NULL DEFAULT 'choXacNhan',
    nguoiDuyetId INT NULL,
    ngayTao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ngayCapNhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fkDonHangKhach FOREIGN KEY (nguoiDungId) REFERENCES nguoiDung(id) ON DELETE RESTRICT,
    CONSTRAINT fkDonHangAdmin FOREIGN KEY (nguoiDuyetId) REFERENCES nguoiDung(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Bảng chiTietDonHang: Lưu từng sản phẩm, số lượng và giá chốt tại thời điểm mua
-- ----------------------------------------------------------------------------
CREATE TABLE chiTietDonHang (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donHangId INT NOT NULL,
    sanPhamHoaId INT NOT NULL,
    soLuong INT NOT NULL,
    donGia DECIMAL(12, 2) NOT NULL,
    CONSTRAINT fkChiTietDonHang FOREIGN KEY (donHangId) REFERENCES donHang(id) ON DELETE CASCADE,
    CONSTRAINT fkChiTietHoa FOREIGN KEY (sanPhamHoaId) REFERENCES sanPhamHoa(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. Bảng lichSuNhanDien: Lưu vết ảnh tải lên và kết quả phân loại của SVM
-- ----------------------------------------------------------------------------
CREATE TABLE lichSuNhanDien (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nguoiDungId INT NULL,
    duongDanAnh VARCHAR(255) NOT NULL,
    nhanDuDoan VARCHAR(50) NOT NULL,
    doTinCay FLOAT NOT NULL,
    ngayTao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fkNhanDienNguoiDung FOREIGN KEY (nguoiDungId) REFERENCES nguoiDung(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- DỮ LIỆU MẪU KHỞI TẠO (SEED DATA)
-- ============================================================================

-- 1. Tài khoản Quản trị viên & Khách hàng mẫu
INSERT INTO nguoiDung (hoTen, email, matKhau, soDienThoai, diaChi, vaiTro) VALUES
('Quản Trị Viên Hệ Thống', 'admin@flowershop.vn', '$2b$12$hashed_admin_password_example', '0901234567', 'Quận Cầu Giấy, Hà Nội', 'quanTriVien'),
('Nguyễn Văn Khách', 'user@gmail.com', '$2b$12$hashed_user_password_example', '0987654321', 'Quận Thanh Xuân, Hà Nội', 'khachHang');

-- 2. Danh sách 5 sản phẩm hoa tương ứng 5 lớp của mô hình SVM
INSERT INTO sanPhamHoa (tenSanPham, nhanAi, tenLoaiHoa, giaBan, soLuongTon, moTa, hinhAnh, nguoiTaoId) VALUES
('Bó Hoa Hồng Nhung Đỏ Thắm', 'hoaHong', 'Hoa Hồng', 350000, 30, '20 bông hồng nhung đỏ Đà Lạt tượng trưng cho tình yêu nồng cháy.', '/uploads/rose_bouquet.jpg', 1),
('Bó Hướng Dương Nắng Mới', 'huongDuong', 'Hoa Hướng Dương', 280000, 25, 'Hoa hướng dương tươi rực rỡ, thích hợp tặng tốt nghiệp và khai trương.', '/uploads/sunflower_bouquet.jpg', 1),
('Bó Tulip Hà Lan Thanh Lịch', 'tulip', 'Hoa Tulip', 480000, 15, 'Hoa Tulip hồng nhập khẩu mang vẻ đẹp sang trọng, tinh tế.', '/uploads/tulip_bouquet.jpg', 1),
('Bó Cúc Họa Mi Tinh Khôi', 'cucHoaMi', 'Hoa Cúc Họa Mi', 210000, 40, 'Cúc họa mi trắng nhẹ nhàng, thuần khiết.', '/uploads/daisy_bouquet.jpg', 1),
('Bó Bồ Công Anh Nghệ Thuật', 'boCongAnh', 'Hoa Bồ Công Anh', 190000, 20, 'Hoa bồ công anh khô trang trí bàn làm việc độc đáo.', '/uploads/dandelion_bouquet.jpg', 1);

-- 3. Đơn hàng mẫu để kiểm thử luồng lịch sử mua hàng & duyệt đơn của Admin
INSERT INTO donHang (maDonHang, nguoiDungId, tenNguoiNhan, sdtNguoiNhan, diaChiGiao, ghiChu, tongTien, phuongThucThanhToan, trangThaiThanhToan, trangThai, nguoiDuyetId) VALUES
('DH20260001', 2, 'Trần Thị Mai', '0912345678', 'Số 120 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Giao trước 10h sáng kèm thiệp chúc mừng', 770000, 'chuyenKhoan', 'daThanhToan', 'daXacNhan', 1);

INSERT INTO chiTietDonHang (donHangId, sanPhamHoaId, soLuong, donGia) VALUES
(1, 1, 1, 350000),
(1, 4, 2, 210000);