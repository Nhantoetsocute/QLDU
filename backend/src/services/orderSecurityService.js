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
    if (!Number.isFinite(totalAmount) || totalAmount<0 || totalAmount>1e9 || (input.paymentMethodId===2 && (totalAmount<=0 || !Number.isInteger(totalAmount)))) reject('Tổng tiền không hợp lệ.');
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
    if (Number(order.PaymentMethodId)===2) reject('Đơn SePay cần xác nhận thanh toán hoặc xử lý hoàn tiền qua hỗ trợ.',409);
    await connection.execute('UPDATE Orders SET StatusId = 4 WHERE OrderId = ? AND UserId = ? AND StatusId = 1',[orderId,userId]);
    await restoreStock(connection,orderId);
    return {orderCode:order.OrderCode};
}
function cents(value) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) return null;
    const [whole,fraction='']=String(value).split('.'); return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
async function lockGatewayOrder(connection,orderCode) {
    const [orders]=await connection.execute('SELECT OrderId,TotalAmount,StatusId,PaymentMethodId FROM Orders WHERE OrderCode = ? FOR UPDATE',[orderCode]);
    const order=orders[0];
    if (!order || Number(order.PaymentMethodId)!==2) return null;
    const [payments]=await connection.execute('SELECT State FROM PaymentTransactions WHERE OrderId = ? FOR UPDATE',[order.OrderId]);
    return payments[0] ? {...order,State:payments[0].State} : null;
}
async function failPayment(connection,order,transactionNo=null) {
    await connection.execute("UPDATE PaymentTransactions SET State = 'failed', TransactionNo = ? WHERE OrderId = ?",[transactionNo,order.OrderId]);
    const [updated]=await connection.execute('UPDATE Orders SET StatusId = 4 WHERE OrderId = ? AND StatusId = 1',[order.OrderId]);
    if (updated.affectedRows===1) await restoreStock(connection,order.OrderId);
}
// Customer cancelled / gateway error on the SePay page (return URL with a valid token). Never touches a paid order.
async function cancelPendingPayment(connection,orderCode) {
    const order=await lockGatewayOrder(connection,orderCode);
    if (!order || order.State!=='pending' || Number(order.StatusId)!==1) return false;
    await failPayment(connection,order);
    return true;
}
const transactionRef=value=>String(value ?? '').replace(/[^A-Za-z0-9_-]/g,'').slice(0,60) || null;
/**
 * Authenticated SePay IPN (safe to replay). Mirrors sepay_handle_ipn in WEB-PHP.
 * @returns 'paid' | 'duplicate' | 'mismatch' | 'late' | 'voided' | 'ignored' | 'unknown'
 */
async function handleSepayIpn(connection,data) {
    const remote=data?.order && typeof data.order==='object' ? data.order : {};
    const tx=data?.transaction && typeof data.transaction==='object' ? data.transaction : {};
    const type=data?.notification_type;
    if (type!=='ORDER_PAID' && type!=='TRANSACTION_VOID') return 'ignored';
    const invoice=String(remote.order_invoice_number ?? '');
    if (!/^[A-Z0-9-]{1,40}$/.test(invoice)) return 'unknown';
    const order=await lockGatewayOrder(connection,invoice);
    if (!order) return 'unknown';
    if (type==='TRANSACTION_VOID') {
        if (order.State!=='paid' || Number(order.StatusId)!==1) return 'duplicate'; // shipped/finished: admin refunds manually
        await failPayment(connection,order,transactionRef(tx.transaction_id ?? tx.id));
        return 'voided';
    }
    if (remote.order_status!=='CAPTURED' || (tx.transaction_status!==undefined && tx.transaction_status!=='APPROVED')) return 'ignored';
    const amount=cents(remote.order_amount);
    if (amount===null || amount!==cents(order.TotalAmount)) return 'mismatch';
    const ref=transactionRef(tx.transaction_id ?? tx.id ?? remote.id);
    if (order.State==='failed') {
        // Money arrived after the order was cancelled: keep it visible for refund/reconciliation.
        await connection.execute('UPDATE PaymentTransactions SET TransactionNo = ? WHERE OrderId = ?',[`LATE_PAID:${ref || ''}`.slice(0,100),order.OrderId]);
        return 'late';
    }
    if (order.State!=='pending' || Number(order.StatusId)!==1) return 'duplicate';
    await connection.execute("UPDATE PaymentTransactions SET State = 'paid', TransactionNo = ? WHERE OrderId = ?",[ref,order.OrderId]);
    return 'paid';
}
async function transaction(pool,work) {
    let connection;
    try {
        connection=await pool.getConnection(); await connection.beginTransaction();
        const result=await work(connection); await connection.commit(); return result;
    } catch(e) { if(connection) await connection.rollback(); throw e; }
    finally { if(connection) connection.release(); }
}
module.exports={lockActiveAccount,createOrder,cancelOrder,cancelPendingPayment,handleSepayIpn,transaction,cents};
