require('dotenv').config({path: './.env'});
const pool = require('./src/config/db');

async function seed() {
    try {
        // 1. Ensure Categories exist
        await pool.execute("INSERT IGNORE INTO Category (CategoryId, CategoryName) VALUES (1, 'Cà phê'), (2, 'Trà'), (3, 'Sinh tố'), (4, 'Nước ép'), (5, 'Sữa'), (6, 'Giải khát'), (7, 'Dinh dưỡng')");

        // 2. Insert/Update Foods - synced with HomeScreen & AllProductsScreen
        const foods = [
            // HomeScreen Premium Products
            { id: 1, name: 'Nước ép rau má', cat: 4, price: 120000, desc: 'Rau má tươi xay lạnh cùng chút đường phèn thanh nhẹ, giúp giải nhiệt và làm dịu cơ thể trong ngày nắng.', stock: 100, image: '/images/rauma.jpg' },
            { id: 2, name: 'Trà đào cam sả', cat: 2, price: 55000, desc: 'Sự kết hợp của trà đen ủ đậm, đào ngọt dịu, cam mọng nước và hương sả thơm mát, cân bằng chua ngọt.', stock: 100, image: '/images/tra_cam_xa.jpg' },
            { id: 3, name: 'Trà Chanh', cat: 2, price: 35000, desc: 'Vị trà thanh nhẹ hòa cùng chanh tươi và đá lạnh, mang cảm giác sảng khoái tức thì.', stock: 100, image: '/images/tra_chanh.webp' },
            { id: 4, name: 'Trà Xanh', cat: 2, price: 40000, desc: 'Trà xanh nguyên lá với hậu vị dịu và hương thơm tự nhiên, phù hợp cho người thích vị trà thuần khiết.', stock: 100, image: '/images/tra_xanh.jpg' },
            { id: 5, name: 'Cà phê sữa đá', cat: 1, price: 29000, desc: 'Cà phê pha phin truyền thống thơm lừng kết hợp cùng sữa đặc béo ngậy.', stock: 100, image: '/images/CPSD.webp' },
            // Extended Products
            { id: 6, name: 'Nước Ion Kiềm Cao Cấp', cat: 7, price: 25000, desc: 'Nước ion kiềm tinh lọc với vị mềm nhẹ, hỗ trợ bù khoáng và làm dịu cơ thể sau vận động.', stock: 200, image: '/images/ion.png' },
            { id: 7, name: 'Soda Mix Dâu Rừng', cat: 6, price: 45000, desc: 'Soda mát lạnh kết hợp siro dâu rừng thơm ngọt, tạo cảm giác sủi tê vui miệng và trẻ trung.', stock: 100, image: '/images/soda.jpg' },
            { id: 8, name: 'Sữa Hạnh Nhân Organic', cat: 5, price: 65000, desc: 'Sữa hạnh nhân nguyên chất, béo nhẹ tự nhiên, không ngấy, phù hợp cho lối sống lành mạnh.', stock: 80, image: '/images/sua.jpg' },
            { id: 9, name: 'Nước Ép Cam Tươi', cat: 4, price: 55000, desc: 'Cam tươi ép tại quầy giữ trọn vị chua ngọt tự nhiên và hương thơm mọng nước giàu vitamin C.', stock: 100, image: '/images/cam.png' },
            { id: 10, name: 'Protein Shake Socola', cat: 7, price: 85000, desc: 'Protein shake vị socola đậm đà, tăng năng lượng nhanh, thích hợp trước hoặc sau khi tập luyện.', stock: 50, image: '/images/protein.jpeg' },
            { id: 11, name: 'Nước Ép Nhãn Lồng', cat: 4, price: 60000, desc: 'Nhãn lồng Hưng Yên ép tươi ngọt thanh, mát lành, bổ dưỡng.', stock: 80, image: '/images/nhan.jpg' },
        ];

        for (const f of foods) {
            await pool.execute(
                `INSERT INTO Food (FoodId, FoodName, CategoryId, BasePrice, Stock, Description, ImageUrl) 
                 VALUES (?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE FoodName=VALUES(FoodName), BasePrice=VALUES(BasePrice), Description=VALUES(Description), Stock=VALUES(Stock), ImageUrl=VALUES(ImageUrl)`,
                [f.id, f.name, f.cat, f.price, f.stock, f.desc, f.image]
            );
        }

        // Verify
        const [rows] = await pool.execute('SELECT FoodId, FoodName, BasePrice FROM Food ORDER BY FoodId');
        console.log(`✅ Seeded ${rows.length} products:`);
        rows.forEach(r => console.log(`  [${r.FoodId}] ${r.FoodName} - ${Number(r.BasePrice).toLocaleString('vi-VN')} đ`));
    } catch (e) {
        console.error("❌ Seeding fail:", e.message);
    } finally {
        process.exit();
    }
}
seed();
