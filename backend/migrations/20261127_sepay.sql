-- Đổi tên phương thức thanh toán id=2 từ VNPAY sang SEPAY (database đã tạo trước khi chuyển cổng).
UPDATE PhuongThucThanhToan SET TenPhuongThuc = 'SEPAY' WHERE PaymentMethodId = 2;
