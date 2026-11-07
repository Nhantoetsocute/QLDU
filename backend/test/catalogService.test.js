const test = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogService } = require('../src/services/catalogService');

const createFixture = () => createCatalogService({
  database: {
    query: async (sql) => [sql.includes('FROM FoodIngredient') ? [
      { FoodId: 11, IngredientName: 'Nhãn' },
    ] : [
      { FoodId: 11, FoodName: 'Nước Ép Nhãn Lồng', CategoryId: 4, CategoryName: 'Nước ép', BasePrice: '60000.00', DiscountPercent: '25.00', Stock: 80, ImageUrl: '/images/nhan.jpg', Description: 'Nhãn tươi' },
      { FoodId: 3, FoodName: 'Trà Chanh', CategoryId: 2, CategoryName: 'Trà', BasePrice: '35000.00', DiscountPercent: '0', Stock: 100, ImageUrl: '/images/tra_chanh.webp', Description: 'Trà và chanh' },
    ]],
  },
  stores: [{ id: '1', name: 'True Juice Thái Hà', address: '12 Thái Hà', time: '07:00 - 22:30', amenities: ['Wifi miễn phí'] }],
});

test('catalog quotes the same BasePrice as current billing and preserves actual ingredients', async () => {
  const { products } = await createFixture().getCatalogSnapshot();
  assert.equal(products[0].id, 11);
  assert.equal(products[0].name, 'Nước Ép Nhãn Lồng');
  assert.equal(products[0].basePrice, 60000);
  assert.equal(products[0].price, 60000);
  assert.equal(products[0].discountPercent, 25);
  assert.equal(products[0].discountApplied, false);
  assert.deepEqual(products[0].ingredients, ['Nhãn']);
  assert.deepEqual(products[1].ingredients, []);
});

test('budget filtering uses the price actually charged by current billing', async () => {
  const service = createFixture();
  assert.deepEqual((await service.getProductsByPrice(40000)).map((product) => product.id), [3]);
  assert.deepEqual((await service.getProductsByPrice(50000)).map((product) => product.id), [3]);
  assert.deepEqual((await service.getProductsByPrice(60000)).map((product) => product.id), [11, 3]);
});

test('Vietnamese product and category search works without accents', async () => {
  const service = createFixture();
  assert.deepEqual((await service.searchProducts('nhan long')).map((product) => product.id), [11]);
  assert.deepEqual((await service.getProductsByCategory('nuoc ep')).map((product) => product.id), [11]);
  assert.deepEqual((await service.getProductsByCategory(2)).map((product) => product.id), [3]);
});

test('unknown products are never replaced with a mock product', async () => {
  const service = createFixture();
  assert.deepEqual(await service.searchProducts('Matcha Latte'), []);
  assert.equal(await service.getProductById(999), null);
});

test('store results contain published information and are isolated from caller mutation', async () => {
  const service = createFixture();
  const stores = await service.getStoreInformation('thai ha');
  assert.equal(stores[0].time, '07:00 - 22:30');
  assert.equal('distance' in stores[0], false);
  assert.equal('status' in stores[0], false);
  stores[0].amenities.push('Fake amenity');
  assert.deepEqual((await service.getStoreInformation())[0].amenities, ['Wifi miễn phí']);
});
