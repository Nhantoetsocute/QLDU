/**
 * ===================================================
 *  QLDU – Backend API Test Suite (Full Coverage)
 *  Chạy: node tests/api_test_suite.js
 *  Yêu cầu: backend đang chạy tại localhost:3000
 * ===================================================
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// ─── Màu sắc console ───────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

// ─── Biến lưu trạng thái test ──────────────────────
let passed = 0;
let failed = 0;
let authToken = '';
let registeredEmail = '';
let cartItemId = null;
let orderId = null;
let foodId = null;

// ─── Helper: HTTP Request ──────────────────────────
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Helper: Kiểm tra & log kết quả ───────────────
function assert(testName, condition, detail = '') {
  if (condition) {
    console.log(`  ${GREEN}✓${RESET} ${testName}`);
    if (detail) console.log(`    ${CYAN}→ ${detail}${RESET}`);
    passed++;
  } else {
    console.log(`  ${RED}✗ FAIL${RESET} ${testName}`);
    if (detail) console.log(`    ${RED}→ ${detail}${RESET}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${BOLD}${YELLOW}══ ${title} ══${RESET}`);
}

// ═══════════════════════════════════════════════════
//  TEST FUNCTIONS
// ═══════════════════════════════════════════════════

async function testHealthCheck() {
  section('0. Health Check – Server Alive');
  try {
    const res = await request('GET', '/api/categories');
    assert('Server đang chạy (status 200)', res.status === 200, `HTTP ${res.status}`);
  } catch (e) {
    assert('Server đang chạy', false, `Không kết nối được: ${e.message}`);
    console.log(`\n${RED}${BOLD}⛔ Backend chưa chạy! Hãy chạy: node server.js${RESET}\n`);
    process.exit(1);
  }
}

async function testAuth() {
  section('1. Auth Module');

  // 1.1 Register – thiếu field bắt buộc
  const badReg = await request('POST', '/api/auth/register', { email: 'test@x.com' });
  assert(
    'POST /api/auth/register → 400 khi thiếu trường',
    badReg.status === 400,
    `status=${badReg.status}`
  );

  // 1.2 Register thành công
  registeredEmail = `test_${Date.now()}@qldu.vn`;
  const regRes = await request('POST', '/api/auth/register', {
    userName: 'Test User Auto',
    email: registeredEmail,
    password: 'Test@123',
    phone: '09' + String(Date.now()).slice(-8)
  });
  assert(
    'POST /api/auth/register → 201 tạo mới thành công',
    regRes.status === 201,
    `userId=${regRes.body.userId}`
  );

  // 1.3 Register trùng email
  const dupReg = await request('POST', '/api/auth/register', {
    userName: 'Dup User',
    email: registeredEmail,
    password: 'Test@123',
    phone: '0900000001'
  });
  assert(
    'POST /api/auth/register → 400 khi trùng email',
    dupReg.status === 400,
    `message=${dupReg.body.error}`
  );

  // 1.4 Login sai mật khẩu
  const badLogin = await request('POST', '/api/auth/login', {
    email: registeredEmail,
    password: 'WrongPass'
  });
  assert(
    'POST /api/auth/login → 400 khi sai mật khẩu',
    badLogin.status === 400,
    `message=${badLogin.body.error}`
  );

  // 1.5 Login tài khoản không tồn tại
  const noUser = await request('POST', '/api/auth/login', {
    email: 'khongtontai@x.com',
    password: '123'
  });
  assert(
    'POST /api/auth/login → 404 tài khoản không tồn tại',
    noUser.status === 404,
    `message=${noUser.body.error}`
  );

  // 1.6 Login thành công
  const loginRes = await request('POST', '/api/auth/login', {
    email: registeredEmail,
    password: 'Test@123'
  });
  assert(
    'POST /api/auth/login → 200, trả về token',
    loginRes.status === 200 && loginRes.body.token,
    `token prefix=${loginRes.body.token ? loginRes.body.token.slice(0, 20) + '...' : 'N/A'}`
  );
  authToken = loginRes.body.token || '';

  // 1.7 GET /auth/profile với token
  const profRes = await request('GET', '/api/auth/profile', null, authToken);
  assert(
    'GET /api/auth/profile → 200, trả về thông tin user',
    profRes.status === 200 && profRes.body.Email === registeredEmail,
    `email=${profRes.body.Email}`
  );

  // 1.8 GET /auth/profile không có token
  const noToken = await request('GET', '/api/auth/profile');
  assert(
    'GET /api/auth/profile → 401 khi không có token',
    noToken.status === 401,
    `status=${noToken.status}`
  );
}

async function testFood() {
  section('2. Food Module');

  // 2.1 Lấy danh sách danh mục
  const catRes = await request('GET', '/api/categories');
  assert(
    'GET /api/categories → 200, trả về mảng',
    catRes.status === 200 && Array.isArray(catRes.body),
    `${catRes.body.length} danh mục`
  );

  // 2.2 Lấy danh sách món ăn
  const foodRes = await request('GET', '/api/food');
  assert(
    'GET /api/food → 200, trả về mảng',
    foodRes.status === 200 && Array.isArray(foodRes.body),
    `${foodRes.body.length} món ăn`
  );

  // Lưu foodId để dùng cho cart test
  if (foodRes.body.length > 0) {
    foodId = foodRes.body[0].FoodId;
  }

  // 2.3 Lọc theo danh mục
  if (catRes.body.length > 0) {
    const catId = catRes.body[0].CategoryId;
    const filteredRes = await request('GET', `/api/food?categoryId=${catId}`);
    assert(
      `GET /api/food?categoryId=${catId} → 200, lọc theo danh mục`,
      filteredRes.status === 200 && Array.isArray(filteredRes.body),
      `${filteredRes.body.length} món trong danh mục`
    );
  }

  // 2.4 Chi tiết 1 món
  if (foodId) {
    const detailRes = await request('GET', `/api/food/${foodId}`);
    assert(
      `GET /api/food/${foodId} → 200, chi tiết món`,
      detailRes.status === 200 && detailRes.body.FoodId === foodId,
      `FoodName=${detailRes.body.FoodName}`
    );
  }

  // 2.5 Món không tồn tại
  const notFound = await request('GET', '/api/food/99999999');
  assert(
    'GET /api/food/99999999 → 404 không tìm thấy',
    notFound.status === 404,
    `message=${notFound.body.error}`
  );
}

async function testVoucher() {
  section('3. Voucher Module');

  const res = await request('GET', '/api/vouchers');
  assert(
    'GET /api/vouchers → 200, trả về mảng',
    res.status === 200 && Array.isArray(res.body),
    `${res.body.length} voucher`
  );
}

async function testCart() {
  section('4. Cart Module');

  if (!authToken) {
    console.log(`  ${YELLOW}⚠ Bỏ qua Cart tests (không có token)${RESET}`);
    return;
  }

  // 4.1 Lấy giỏ hàng ban đầu
  const emptyCart = await request('GET', '/api/cart', null, authToken);
  assert(
    'GET /api/cart → 200, trả về mảng',
    emptyCart.status === 200 && Array.isArray(emptyCart.body),
    `${emptyCart.body.length} item trong giỏ`
  );

  // 4.2 Thêm món vào giỏ
  if (foodId) {
    const addRes = await request('POST', '/api/cart', { productId: foodId, quantity: 2 }, authToken);
    assert(
      'POST /api/cart → 201, thêm vào giỏ',
      addRes.status === 201,
      `message=${addRes.body.message}`
    );

    // Lấy cartId cho update/delete
    const cartRes = await request('GET', '/api/cart', null, authToken);
    if (cartRes.body.length > 0) {
      cartItemId = cartRes.body[0].id;
      assert(
        'GET /api/cart → kiểm tra item vừa thêm',
        cartRes.body.some(item => item.productId === foodId),
        `cartItemId=${cartItemId}`
      );
    }

    // 4.3 Cập nhật số lượng
    if (cartItemId) {
      const updateRes = await request('PUT', `/api/cart/${cartItemId}`, { quantity: 5 }, authToken);
      assert(
        `PUT /api/cart/${cartItemId} → 200, cập nhật số lượng`,
        updateRes.status === 200,
        `message=${updateRes.body.message}`
      );

      // Kiểm tra số lượng đã thực sự cập nhật
      const verifyCart = await request('GET', '/api/cart', null, authToken);
      const updatedItem = verifyCart.body.find(i => i.id === cartItemId);
      assert(
        'Xác nhận số lượng = 5 sau khi update',
        updatedItem && updatedItem.quantity === 5,
        `quantity=${updatedItem ? updatedItem.quantity : 'N/A'}`
      );
    }
  }

  // 4.4 Test không có token → 401
  const noAuth = await request('GET', '/api/cart');
  assert(
    'GET /api/cart → 401 khi không có token',
    noAuth.status === 401,
    `status=${noAuth.status}`
  );
}

async function testOrder() {
  section('5. Order Module');

  if (!authToken) {
    console.log(`  ${YELLOW}⚠ Bỏ qua Order tests (không có token)${RESET}`);
    return;
  }

  // 5.1 Lấy lịch sử đơn hàng
  const histRes = await request('GET', '/api/orders', null, authToken);
  assert(
    'GET /api/orders → 200, lịch sử đơn hàng',
    histRes.status === 200 && Array.isArray(histRes.body),
    `${histRes.body.length} đơn hàng`
  );

  // 5.2 Tạo đơn từ giỏ hàng rỗng → 400
  // Xóa giỏ trước (nếu còn gì)
  if (cartItemId) {
    await request('DELETE', `/api/cart/${cartItemId}`, null, authToken);
  }
  const emptyOrderRes = await request('POST', '/api/orders', {
    paymentMethodId: 1,
    receiverName: 'Test User',
    receiverPhone: '0909999888',
    deliveryAddress: '123 Test Street'
  }, authToken);
  assert(
    'POST /api/orders → 400 khi giỏ hàng trống',
    emptyOrderRes.status === 400,
    `message=${emptyOrderRes.body.error}`
  );

  // 5.3 Thêm lại vào giỏ, rồi tạo đơn
  if (foodId) {
    await request('POST', '/api/cart', { productId: foodId, quantity: 1 }, authToken);
    
    const createRes = await request('POST', '/api/orders', {
      paymentMethodId: 1,
      receiverName: 'Test Auto Order',
      receiverPhone: '0909999888',
      deliveryAddress: '1 QLDU Test Street',
      note: 'Đơn test tự động'
    }, authToken);
    assert(
      'POST /api/orders → 201, tạo đơn hàng thành công',
      createRes.status === 201,
      `orderCode=${createRes.body.orderCode}`
    );
    orderId = createRes.body.orderId;

    // Kiểm tra giỏ hàng được xóa sau khi đặt
    const emptyCart = await request('GET', '/api/cart', null, authToken);
    assert(
      'Giỏ hàng được xóa sau khi đặt hàng',
      emptyCart.status === 200 && emptyCart.body.length === 0,
      `giỏ còn ${emptyCart.body.length} item`
    );
  }

  // 5.4 Lấy chi tiết đơn hàng
  if (orderId) {
    const detailRes = await request('GET', `/api/orders/${orderId}`, null, authToken);
    assert(
      `GET /api/orders/${orderId} → 200, chi tiết đơn`,
      detailRes.status === 200,
      `OrderId=${detailRes.body.OrderId}`
    );
  }

  // 5.5 Xem đơn không tồn tại
  const notFound = await request('GET', '/api/orders/99999999', null, authToken);
  assert(
    'GET /api/orders/99999999 → 404 đơn không tồn tại',
    notFound.status === 404,
    `message=${notFound.body.error}`
  );
}

async function testUserProfile() {
  section('6. User Profile Module');

  if (!authToken) {
    console.log(`  ${YELLOW}⚠ Bỏ qua User tests (không có token)${RESET}`);
    return;
  }

  // 6.1 GET profile
  const profRes = await request('GET', '/api/user/profile', null, authToken);
  assert(
    'GET /api/user/profile → 200, trả về profile',
    profRes.status === 200 && profRes.body.email === registeredEmail,
    `email=${profRes.body.email}`
  );

  // 6.2 PUT cập nhật profile
  const updateRes = await request('PUT', '/api/user/profile', {
    name: 'Tên Đã Cập Nhật',
    phone: '08' + String(Date.now()).slice(-8),
    address: '456 Đường Kiểm Thử'
  }, authToken);
  assert(
    'PUT /api/user/profile → 200, cập nhật thành công',
    updateRes.status === 200,
    `status=${updateRes.status}, message=${updateRes.body.message || JSON.stringify(updateRes.body)}`
  );

  // 6.3 Xác nhận dữ liệu đã thực sự thay đổi
  const verifyProf = await request('GET', '/api/user/profile', null, authToken);
  assert(
    'Xác nhận profile đã được thay đổi',
    verifyProf.body.name === 'Tên Đã Cập Nhật',
    `name=${verifyProf.body.name}`
  );
}

// ─── Summary ──────────────────────────────────────
function printSummary() {
  const total = passed + failed;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`${BOLD}📊 KẾT QUẢ TEST${RESET}`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  Tổng số test   : ${total}`);
  console.log(`  ${GREEN}Passed${RESET}          : ${GREEN}${passed}${RESET}`);
  console.log(`  ${RED}Failed${RESET}          : ${failed > 0 ? RED + failed + RESET : failed}`);
  console.log(`  Tỉ lệ thành công: ${GREEN}${Math.round((passed / total) * 100)}%${RESET}`);
  console.log(`${'═'.repeat(50)}\n`);

  if (failed === 0) {
    console.log(`${GREEN}${BOLD}🎉 Tất cả tests PASSED! Hệ thống hoạt động bình thường.${RESET}\n`);
  } else {
    console.log(`${RED}${BOLD}⚠ Có ${failed} test(s) FAILED. Cần kiểm tra lại!${RESET}\n`);
  }
}

// ═══════════════════════════════════════════════════
//  MAIN – Chạy lần lượt tất cả tests
// ═══════════════════════════════════════════════════
async function runAllTests() {
  console.log(`\n${BOLD}${CYAN}`);
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       QLDU – API Test Suite (Full)           ║');
  console.log('║       QuanLyBanNuoc Backend v1.0             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(RESET);

  try {
    await testHealthCheck();
    await testAuth();
    await testFood();
    await testVoucher();
    await testCart();
    await testOrder();
    await testUserProfile();
  } catch (err) {
    console.error(`\n${RED}${BOLD}❌ Lỗi không mong muốn: ${err.message}${RESET}`);
    failed++;
  }

  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
