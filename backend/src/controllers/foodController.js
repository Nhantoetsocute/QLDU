const pool = require('../config/db');

// Lấy danh sách danh mục
exports.getCategories = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT CategoryId, CategoryName FROM Category WHERE IsActive = 1 ORDER BY CategoryName"
        );
        res.json(rows);
    } catch (error) {
        console.error('GetCategories error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Lấy danh sách món ăn — Tối ưu: thêm phân trang, sắp xếp
exports.getFoods = async (req, res) => {
    try {
        const { categoryId, search, page = 1, limit = 50 } = req.query;
        const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

        let sql = `
            SELECT f.FoodId, f.FoodName, f.BasePrice, f.DiscountPercent, f.Stock, 
                   f.ImageUrl, f.Description, c.CategoryName 
            FROM Food f 
            LEFT JOIN Category c ON f.CategoryId = c.CategoryId
            WHERE f.IsActive = 1
        `;
        let params = [];

        if (categoryId) {
            sql += " AND f.CategoryId = ?";
            params.push(categoryId);
        }

        if (search) {
            sql += " AND f.FoodName LIKE ?";
            params.push(`%${search}%`);
        }

        sql += " ORDER BY f.FoodName LIMIT ? OFFSET ?";
        params.push(parseInt(limit), offset);

        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('GetFoods error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Lấy thông tin 1 món
exports.getFoodById = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT f.*, c.CategoryName 
            FROM Food f 
            LEFT JOIN Category c ON f.CategoryId = c.CategoryId 
            WHERE f.FoodId = ? AND f.IsActive = 1
        `, [req.params.id]);

        if (rows.length === 0) return res.status(404).json({ error: "Không tìm thấy món" });
        res.json(rows[0]);
    } catch (error) {
        console.error('GetFoodById error:', error.message);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
