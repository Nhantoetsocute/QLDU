const fail = (message = 'Dữ liệu yêu cầu không hợp lệ.') => { const e = new Error(message); e.status = 400; throw e; };
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function text(v, max, min = 1) {
    if (typeof v !== 'string' || v.trim().length < min || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)) fail();
    return v.trim();
}
function id(v) {
    if (!((typeof v === 'number' && Number.isSafeInteger(v)) || (typeof v === 'string' && /^[1-9]\d{0,14}$/.test(v)))) fail('ID không hợp lệ.');
    const n = Number(v); if (!Number.isSafeInteger(n) || n < 1) fail('ID không hợp lệ.'); return n;
}
function quantity(v) { if (!Number.isInteger(v) || v < 1 || v > 99) fail('Số lượng phải là số nguyên từ 1 đến 99.'); return v; }
function money(v) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e9) fail('Số tiền không hợp lệ.'); return v; }
function phone(v) { v = text(v, 20); if (!/^\+?[0-9][0-9 ()-]{7,18}$/.test(v)) fail('Số điện thoại không hợp lệ.'); return v; }
function email(v) { v = text(v, 190).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('Email không hợp lệ.'); return v; }
function password(v, strong = false) {
    if (strong && typeof v === 'string' && require('./passwordPolicy').isCommonPassword(v)) {
        const error = new Error('Mật khẩu này quá phổ biến và dễ bị đoán. Vui lòng chọn mật khẩu khác để bảo vệ tài khoản.');
        error.status = 400;
        error.code = 'WEAK_PASSWORD';
        throw error;
    }
    if (typeof v !== 'string' || !v.length || Buffer.byteLength(v) > (strong ? 72 : 256) || (strong && v.length < 12)) fail('Mật khẩu cần ít nhất 12 ký tự và tối đa 72 byte.');
    return v;
}
function fields(body, allowed) { if (!object(body) || Object.keys(body).some(k => !allowed.includes(k))) fail('Yêu cầu chứa trường không được phép.'); }
function items(list) {
    if (!Array.isArray(list) || !list.length || list.length > 50) fail('Giỏ hàng cần từ 1 đến 50 món.');
    const seen = new Set();
    return list.map(item => {
        fields(item, ['id', 'productId', 'quantity', 'name', 'price']);
        const productId = id(item.productId ?? item.id);
        if (seen.has(productId)) fail('Sản phẩm bị lặp trong giỏ hàng.'); seen.add(productId);
        return { productId, quantity: quantity(item.quantity) };
    });
}
function checkout(body, payment = false) {
    fields(body, payment ? ['type','amount','orderInfo','receiverName','receiverPhone','deliveryAddress','note','voucherId','cartItems'] : ['paymentMethodId','receiverName','receiverPhone','deliveryAddress','note','voucherId','items']);
    const reservation = payment && body.type === 'reservation';
    if (payment && body.type !== undefined && !['order','reservation'].includes(body.type)) fail();
    if (!payment && body.paymentMethodId !== undefined && body.paymentMethodId !== 1) fail('Đơn thường chỉ hỗ trợ COD. Thanh toán VNPay cần qua API thanh toán.');
    if (payment && body.amount !== undefined) money(body.amount); // Never used for pricing.
    const result = {
        receiverName: text(body.receiverName ?? (reservation ? 'Khách đặt bàn' : undefined), 120),
        receiverPhone: reservation ? text(body.receiverPhone ?? 'N/A', 20) : phone(body.receiverPhone),
        deliveryAddress: text(body.deliveryAddress ?? (reservation ? 'Tại cửa hàng' : undefined), 255),
        note: body.note == null ? '' : text(body.note, 255, 0),
        voucherId: body.voucherId == null ? null : id(body.voucherId),
        paymentMethodId: payment ? 2 : 1,
        type: reservation ? 'reservation' : 'order',
    };
    if (body.orderInfo !== undefined) result.orderInfo = text(body.orderInfo, 255);
    if (reservation) {
        if (body.voucherId != null || body.cartItems !== undefined) fail();
    } else {
        const list = payment ? body.cartItems : body.items;
        if (payment || list !== undefined) result.items = items(list);
    }
    return result;
}
const schemas = {
    register(b) { fields(b,['userName','email','password','phone']); return { userName:text(b.userName,120),email:email(b.email),password:password(b.password,true),phone:b.phone == null || b.phone === '' ? null : phone(b.phone) }; },
    login(b) { fields(b,['email','password']); return {email:email(b.email),password:password(b.password)}; },
    changePassword(b) { fields(b,['currentPassword','newPassword']); return {currentPassword:password(b.currentPassword),newPassword:password(b.newPassword,true)}; },
    forgot(b) { fields(b,['email']); return {email:email(b.email)}; },
    otp(b) { fields(b,['email','otp']); if (typeof b.otp !== 'string' || !/^\d{6}$/.test(b.otp)) fail(); return {email:email(b.email),otp:b.otp}; },
    reset(b) { fields(b,['email','otp','newPassword']); if (typeof b.otp !== 'string' || !/^\d{6}$/.test(b.otp)) fail(); return {email:email(b.email),otp:b.otp,newPassword:password(b.newPassword,true)}; },
    profile(b) { fields(b,['name','phone','address']); if (!Object.keys(b).length) fail(); const out={}; if ('name' in b) out.name=text(b.name,120); if ('phone' in b) out.phone=b.phone === '' ? '' : phone(b.phone); if ('address' in b) out.address=text(b.address,255,0); return out; },
    cart(b) { fields(b,['productId','quantity']); return {productId:id(b.productId),quantity:quantity(b.quantity)}; },
    quantity(b) { fields(b,['quantity']); return {quantity:quantity(b.quantity)}; },
    voucher(b) { fields(b,['code','orderAmount']); const code=text(b.code,50).toUpperCase(); if (!/^[A-Z0-9_-]+$/.test(code)) fail(); return {code,orderAmount:money(b.orderAmount)}; },
    order: b => checkout(b), payment: b => checkout(b,true),
};
function validate(schema) { return (req,res,next) => { try { req.body=schemas[schema](req.body); next(); } catch(e) { next(e); } }; }
function paramId(req,res,next) { try { req.params.id=String(id(req.params.id)); next(); } catch(e) { next(e); } }
function foodQuery(req,res,next) {
    try {
        fields(req.query,['page','limit','categoryId','search']);
        const page=req.query.page === undefined ? 1 : id(req.query.page);
        const limit=req.query.limit === undefined ? 50 : id(req.query.limit);
        if (page > 10000 || limit > 100) fail('Phân trang không hợp lệ.');
        req.query.page=page; req.query.limit=limit;
        if (req.query.categoryId !== undefined) req.query.categoryId=id(req.query.categoryId);
        if (req.query.search !== undefined) req.query.search=text(req.query.search,100,0);
        next();
    } catch(e) { next(e); }
}
function paymentQuery(req,res,next) {
    try {
        if (Object.keys(req.query).length > 30) fail();
        for (const [key,value] of Object.entries(req.query)) { if (!/^vnp_[A-Za-z]+$/.test(key)) fail(); text(value,500,0); }
        if (!/^[0-9a-f]{128}$/i.test(req.query.vnp_SecureHash || '') || !/^\d{1,14}$/.test(req.query.vnp_Amount || '') || !/^[A-Z0-9-]{1,30}$/.test(req.query.vnp_TxnRef || '')) fail('Dữ liệu thanh toán không hợp lệ.');
        next();
    } catch(e) { next(e); }
}
module.exports = {validate,paramId,foodQuery,paymentQuery,schemas,id,items,quantity,fail};
