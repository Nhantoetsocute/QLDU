/**
 * Cấu hình API tập trung.
 * Khi đổi mạng WiFi, chỉ cần sửa IP ở đây.
 *
 * Cách lấy IP mới:
 *   Windows: ipconfig → IPv4 Address
 *   Mac:     ifconfig | grep inet
 */
const API_HOST = '172.20.10.2';
const API_PORT = '3000';

export const BASE_URL = `http://${API_HOST}:${API_PORT}`;

/**
 * Helper tạo full URL từ path.
 * Ví dụ: apiUrl('/api/auth/login') → 'http://172.20.10.2:3000/api/auth/login'
 */
export const apiUrl = (path) => `${BASE_URL}${path}`;
