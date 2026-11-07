const { sealField } = require('../security/dataFields');
const { randomBytes } = require('node:crypto');
const { quantity, id, fail } = require('../security/validation');
const reject = (message, status = 400) => { const e=new Error(message); e.status=status; throw e; };

async function lockActiveAccount(connection,userId) {
    const [users] = await connection.execute('SELECT UserId, IsActive FROM Users WHERE UserId = ? FOR UPDATE',[userId]);
    if (!users[0] || Number(users[0].IsActive)!==1) reject('Tài khoản không còn hoạt động.',401);
}
async function createOrder(connection, userId, input) {
    await lockActiveAccount(connection,userId);
    let cart = input.items;
    if (input.type !== 'reservation' && !cart) {
        const [rows] = await connection.execute('SELECT FoodId, Quantity FROM GioHang WHERE UserId = ? ORDER BY FoodId FOR UPDATE',[userId]);
        cart = rows.map(r => ({productId:id(r.FoodId),quantity:quantity(r.Quantity)}));
        if (!cart.length || cart.length > 50) fail('Giỏ hàng trống hoặc quá nhiều món.');
    }
    const lines=[];
    // Same lock order for every checkout prevents duplicate-item and concurrent-stock bypasses.
    for (const item of [...(cart || [])].sort((a,b)=>a.productId-b.productId)) {
        const [rows]=await connection.execute('SELECT FoodId, BasePrice, Stock, IsActive FROM Food WHERE FoodId = ? FOR UPDATE',[item.productId]);
        const food=rows[0];
        if (!food || Number(food.IsActive)!==1 || food.Stock < item.quantity) reject('Sản phẩm ngừng bán hoặc không đủ tồn kho.');
        const price=Number(food.BasePrice);
        if (!Number.isFinite(price) || price < 0 || price > 1e9) reject('Giá sản phẩm không hợp lệ.',503);
        lines.push({productId:item.productId,quantity:item.quantity,price});
    }
    // Table deposit is server-owned, matching the existing 100,000 VND policy.
    let totalAmount=input.type === 'reservation' ? 100000 : lines.reduce((sum,l)=>sum+l.price*l.quantity,0);
    if (input.voucherId) {
        const [rows]=await connection.execute('SELECT DiscountAmount, DiscountPercentage, MinOrderAmount FROM Vouchers WHERE VoucherId = ? AND IsActive = 1 AND ExpiryDate > NOW() FOR UPDATE',[input.voucherId]);
        const v=rows[0];
        if (!v || totalAmount < Number(v.MinOrderAmount)) reject('Voucher không hợp lệ hoặc chưa đạt giá trị đơn tối thiểu.');
        const fixed=Number(v.DiscountAmount), percent=Number(v.DiscountPercentage);
        if (!Number.isFinite(fixed) || fixed<0 || !Number.isFinite(percent) || percent<0 || percent>100) reject('Cấu hình voucher không hợp lệ.',503);
        totalAmount=Math.max(0,totalAmount-(fixed>0 ? fixed : Math.round(totalAmount*percent/100)));
    }
    totalAmount=Math.round(totalAmount*100)/100;
    if (!Number.isFinite(totalAmount) || totalAmount<0 || totalAmount>1e9 || (input.paymentMethodId===2 && totalAmount<=0)) reject('Tổng tiền không hợp lệ.');
    const orderCode=(input.type==='reservation'?'RES':'ORD')+new Date().toISOString().slice(2,10).replace(/-/g,'')+randomBytes(8).toString('hex').toUpperCase();
    const [result]=await connection.execute(`INSERT INTO Orders (OrderCode,UserId,TotalAmount,PaymentMethodId,StatusId,VoucherId,ReceiverName,ReceiverPhone,DeliveryAddress,Note) VALUES (?,?,?,?,1,?,?,?,?,?)`,
        [orderCode,userId,totalAmount,input.paymentMethodId,input.voucherId,'','','',null]);
    const orderId=result.insertId;
    await connection.execute('UPDATE Orders SET ReceiverName = ?, ReceiverPhone = ?, DeliveryAddress = ?, Note = ? WHERE OrderId = ?',[
        sealField('Orders',orderId,'ReceiverName',input.receiverName),sealField('Orders',orderId,'ReceiverPhone',input.receiverPhone),
        sealField('Orders',orderId,'DeliveryAddress',input.deliveryAddress),sealField('Orders',orderId,'Note',input.note),orderId,
    ]);
    for (const line of lines) {
        await connection.execute('INSERT INTO OrderDetails (OrderId,FoodId,Quantity,UnitPrice,LineTotal) VALUES (?,?,?,?,?)',[orderId,line.productId,line.quantity,line.price,line.quantity*line.price]);
        const [updated]=await connection.execute('UPDATE Food SET Stock = Stock - ? WHERE FoodId = ? AND IsActive = 1 AND Stock >= ?',[line.quantity,line.productId,line.quantity]);
        if (updated.affectedRows!==1) reject('Tồn kho đã thay đổi. Vui lòng thử lại.',409);
    }
    if (input.paymentMethodId===2) await connection.execute("INSERT INTO PaymentTransactions (OrderId, State) VALUES (?, 'pending')",[orderId]);
    if (!input.items && input.type!=='reservation') await connection.execute('DELETE FROM GioHang WHERE UserId = ?',[userId]);
    return {orderId,orderCode,totalAmount};
}
async function restoreStock(connection,orderId) {
    const [details]=await connection.execute('SELECT FoodId,Quantity FROM OrderDetails WHERE OrderId = ? ORDER BY FoodId',[orderId]);
    for (const detail of details) await connection.execute('UPDATE Food SET Stock = Stock + ? WHERE FoodId = ?',[detail.Quantity,detail.FoodId]);
}
async function cancelOrder(connection,userId,orderId) {
    const [rows]=await connection.execute('SELECT OrderId,OrderCode,StatusId,PaymentMethodId FROM Orders WHERE OrderId = ? AND UserId = ? FOR UPDATE',[orderId,userId]);
    const order=rows[0];
    if (!order) reject('Không tìm thấy đơn hàng.',404);
    if (Number(order.StatusId)!==1) reject('Chỉ có thể hủy đơn đang chuẩn bị.',409);
    // A pending gateway session may still capture funds. User cancellation must not race it.
    if (Number(order.PaymentMethodId)===2) reject('Đơn VNPay cần xác nhận thanh toán hoặc xử lý hoàn tiền qua hỗ trợ.',409);
    await connection.execute('UPDATE Orders SET StatusId = 4 WHERE OrderId = ? AND UserId = ? AND StatusId = 1',[orderId,userId]);
    await restoreStock(connection,orderId);
    return {orderCode:order.OrderCode};
}
function cents(value) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) return null;
    const [whole,fraction='']=String(value).split('.'); return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
async function confirmPayment(connection,query,verify,tmnCode) {
    if (!verify.isVerified || query.vnp_TmnCode!==tmnCode) return {RspCode:'97',Message:'Invalid checksum'};
    const [orders]=await connection.execute('SELECT OrderId,TotalAmount,StatusId,PaymentMethodId FROM Orders WHERE OrderCode = ? FOR UPDATE',[query.vnp_TxnRef]);
    const order=orders[0];
    if (!order || Number(order.PaymentMethodId)!==2) return {RspCode:'01',Message:'Order not found'};
    if (cents(order.TotalAmount)!==BigInt(query.vnp_Amount)) return {RspCode:'04',Message:'Invalid amount'};
    const [payments]=await connection.execute('SELECT State FROM PaymentTransactions WHERE OrderId = ? FOR UPDATE',[order.OrderId]);
    if (!payments[0]) return {RspCode:'01',Message:'Payment not found'};
    if (payments[0].State!=='pending' || Number(order.StatusId)!==1) return {RspCode:'02',Message:'Order already confirmed'};
    const success=verify.isSuccess && query.vnp_TransactionStatus==='00';
    await connection.execute('UPDATE PaymentTransactions SET State = ?, TransactionNo = ? WHERE OrderId = ?',[success?'paid':'failed',query.vnp_TransactionNo || null,order.OrderId]);
    if (!success) {
        await connection.execute('UPDATE Orders SET StatusId = 4 WHERE OrderId = ? AND StatusId = 1',[order.OrderId]);
        await restoreStock(connection,order.OrderId);
    }
    return {RspCode:'00',Message:'Confirm Success'};
}
async function transaction(pool,work) {
    let connection;
    try {
        connection=await pool.getConnection(); await connection.beginTransaction();
        const result=await work(connection); await connection.commit(); return result;
    } catch(e) { if(connection) await connection.rollback(); throw e; }
    finally { if(connection) connection.release(); }
}
module.exports={lockActiveAccount,createOrder,cancelOrder,confirmPayment,transaction,cents};
