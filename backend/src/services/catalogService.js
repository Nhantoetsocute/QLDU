const branchData = require('../data/stores');

const normalizeText = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toProduct = (row, ingredients = []) => {
  const basePrice = Math.max(0, finiteNumber(row.BasePrice));
  const discountPercent = Math.min(100, Math.max(0, finiteNumber(row.DiscountPercent)));
  return {
    id: Number(row.FoodId),
    name: row.FoodName,
    // Existing cart/COD/VNPAY billing charges BasePrice. Keep quoted prices in
    // sync until percentage discounts are supported consistently by billing.
    price: basePrice,
    basePrice,
    discountPercent,
    discountApplied: false,
    stock: Math.max(0, finiteNumber(row.Stock)),
    image: row.ImageUrl || null,
    description: row.Description || '',
    categoryId: Number(row.CategoryId),
    categoryName: row.CategoryName || '',
    ingredients,
  };
};

const createCatalogService = ({ database, stores = branchData } = {}) => {
  const getStoreInformation = async (query = '') => {
    const keyword = normalizeText(query);
    return stores
      .filter((store) => !keyword || normalizeText(`${store.name} ${store.address}`).includes(keyword))
      .map((store) => ({ ...store, amenities: [...store.amenities] }));
  };

  const getCatalogSnapshot = async () => {
    const db = database || require('../config/db');
    const [rows] = await db.query(`
      SELECT f.FoodId, f.FoodName, f.CategoryId, f.BasePrice, f.DiscountPercent,
             f.Stock, f.ImageUrl, f.Description, c.CategoryName
      FROM Food f
      INNER JOIN Category c ON c.CategoryId = f.CategoryId
      WHERE f.IsActive = 1 AND c.IsActive = 1
      ORDER BY f.FoodId
      LIMIT 500
    `);
    const [ingredientRows] = await db.query(`
      SELECT fi.FoodId, i.IngredientName
      FROM FoodIngredient fi
      INNER JOIN Ingredient i ON i.IngredientId = fi.IngredientId
      INNER JOIN Food f ON f.FoodId = fi.FoodId
      WHERE i.IsActive = 1 AND f.IsActive = 1
      ORDER BY fi.FoodId, i.IngredientName
      LIMIT 5000
    `);
    const byProduct = new Map();
    for (const ingredient of ingredientRows) {
      const id = Number(ingredient.FoodId);
      if (!byProduct.has(id)) byProduct.set(id, []);
      byProduct.get(id).push(ingredient.IngredientName);
    }
    return {
      products: rows.map((row) => toProduct(row, byProduct.get(Number(row.FoodId)) || [])),
      stores: await getStoreInformation(),
    };
  };

  const searchProducts = async (options = {}) => {
    if (typeof options === 'string') options = { search: options };
    const { search = '', categoryId, categoryName, minPrice = 0, maxPrice = Infinity, limit = 30 } = options;
    const keyword = normalizeText(search);
    const category = normalizeText(categoryName);
    const { products } = await getCatalogSnapshot();
    return products.filter((product) => (
      (!keyword || normalizeText(`${product.name} ${product.categoryName} ${product.description}`).includes(keyword)) &&
      (categoryId == null || String(product.categoryId) === String(categoryId)) &&
      (!category || normalizeText(product.categoryName).includes(category)) &&
      product.price >= Number(minPrice) && product.price <= Number(maxPrice)
    )).slice(0, Math.min(100, Math.max(1, Math.floor(finiteNumber(limit, 30)))));
  };

  const getProductById = async (id) => {
    const { products } = await getCatalogSnapshot();
    return products.find((product) => String(product.id) === String(id)) || null;
  };

  const getProductsByPrice = (maxPrice, minPrice = 0) => searchProducts({ maxPrice, minPrice });
  const getProductsByCategory = (category) => searchProducts(
    Number.isFinite(Number(category)) ? { categoryId: category } : { categoryName: category }
  );

  return { getCatalogSnapshot, searchProducts, getProductById, getProductsByPrice, getProductsByCategory, getStoreInformation };
};

module.exports = { ...createCatalogService(), createCatalogService, normalizeText, toProduct };
