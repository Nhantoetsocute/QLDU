const pool = require('../config/db');

// Lấy danh sách danh mục
exports.getCategories = async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT CategoryId, CategoryName FROM Category WHERE IsActive = 1");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Lấy danh sách món ăn
exports.getFoods = async (req, res) => {
    try {
        const { categoryId } = req.query;
        let sql = `
            SELECT f.FoodId, f.FoodName, f.BasePrice, f.DiscountPercent, f.Stock, f.ImageUrl, f.Description, 
                   c.CategoryName 
            FROM Food f 
            LEFT JOIN Category c ON f.CategoryId = c.CategoryId
            WHERE f.IsActive = 1
        `;
        let params = [];

        if (categoryId) {
            sql += " AND f.CategoryId = ?";
            params.push(categoryId);
        }

        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (error) {
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
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
