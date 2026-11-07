const { sealField, revealRow, userLookups } = require('../security/dataFields');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const { id } = require('../security/validation');

const MAX_EXPORT_ROWS = 10000;
const MAX_EXPORT_BYTES = 5 * 1024 * 1024;
class PrivacyError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const deny = (status, code, message) => { throw new PrivacyError(status, code, message); };
const pick = (row, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]));

// Account files are selected only by a validated numeric owner and a fixed filename pattern.
// Never use AvatarUrl or traverse/follow directories supplied by a request/database row.
async function cleanupAvatarFiles(userId, directory = path.join(__dirname, '../../public/avatars')) {
    const owner = id(userId);
    const matches = new RegExp(`^avatar_${owner}_[a-zA-Z0-9_-]+\\.(png|jpe?g|webp)$`, 'i');
    let dir;
    let incomplete = false;
    let scanned = 0;
    try {
        dir = await fs.opendir(directory);
        for await (const entry of dir) {
            if (++scanned > 10000) { incomplete = true; break; }
            if (!entry.isFile() || !matches.test(entry.name)) continue;
            try { await fs.unlink(path.join(directory, entry.name)); }
            catch (error) { if (error.code !== 'ENOENT') incomplete = true; }
        }
    } catch (error) { if (error.code !== 'ENOENT') incomplete = true; }
    if (incomplete) console.error('Privacy avatar cleanup requires retry: AVATAR_CLEANUP_PENDING');
    return { incomplete };
}

async function withTransaction(pool, work) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally { if (connection) connection.release(); }
}

function createPrivacyService({ pool, comparePassword = bcrypt.compare, hashPassword = bcrypt.hash,
    random = randomBytes, cleanupAvatars = cleanupAvatarFiles, now = () => new Date() } = {}) {
    if (!pool) throw new Error('Privacy service requires a database pool.');
    async function exportData(rawUserId) {
        const userId = id(rawUserId);
        const result = await withTransaction(pool, async connection => {
            const [users] = await connection.execute(`SELECT UserId, UserCode, UserName, Email, Phone, Address, AvatarUrl, CreatedAt, UpdatedAt
                FROM Users WHERE UserId = ? AND IsActive = 1 LIMIT 1`, [userId]);
            if (!users[0]) deny(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không còn hoạt động.');
            const output = {
                exportedAt: now().toISOString(),
                profile: pick(revealRow('Users',users[0]), ['UserId', 'UserCode', 'UserName', 'Email', 'Phone', 'Address', 'AvatarUrl', 'CreatedAt', 'UpdatedAt']),
            };
            const definitions = [
                ['addresses', `SELECT AddressId, ReceiverName, Phone, AddressLine, IsDefault, CreatedAt, UpdatedAt FROM DeliveryAddresses WHERE UserId = ? ORDER BY AddressId LIMIT 10001`,
                    ['AddressId', 'ReceiverName', 'Phone', 'AddressLine', 'IsDefault', 'CreatedAt', 'UpdatedAt']],
                ['orders', `SELECT OrderId, OrderCode, OrderDate, TotalAmount, PaymentMethodId, StatusId, VoucherId, ReceiverName, ReceiverPhone, DeliveryAddress, Note FROM Orders WHERE UserId = ? ORDER BY OrderId LIMIT 10001`,
                    ['OrderId', 'OrderCode', 'OrderDate', 'TotalAmount', 'PaymentMethodId', 'StatusId', 'VoucherId', 'ReceiverName', 'ReceiverPhone', 'DeliveryAddress', 'Note']],
                ['orderItems', `SELECT d.OrderDetailId, d.OrderId, d.FoodId, d.SizeId, d.Quantity, d.UnitPrice, d.LineTotal FROM OrderDetails d JOIN Orders o ON o.OrderId = d.OrderId WHERE o.UserId = ? ORDER BY d.OrderDetailId LIMIT 10001`,
                    ['OrderDetailId', 'OrderId', 'FoodId', 'SizeId', 'Quantity', 'UnitPrice', 'LineTotal']],
                ['orderToppings', `SELECT t.Id, t.OrderDetailId, t.ToppingId, t.Quantity, t.Price FROM OrderDetail_Toppings t JOIN OrderDetails d ON d.OrderDetailId = t.OrderDetailId JOIN Orders o ON o.OrderId = d.OrderId WHERE o.UserId = ? ORDER BY t.Id LIMIT 10001`,
                    ['Id', 'OrderDetailId', 'ToppingId', 'Quantity', 'Price']],
                ['payments', `SELECT p.OrderId, p.State, p.TransactionNo, p.UpdatedAt FROM PaymentTransactions p JOIN Orders o ON o.OrderId = p.OrderId WHERE o.UserId = ? ORDER BY p.OrderId LIMIT 10001`,
                    ['OrderId', 'State', 'TransactionNo', 'UpdatedAt']],
                ['cart', `SELECT GioHangId, FoodId, SizeId, Quantity, CreatedAt, UpdatedAt FROM GioHang WHERE UserId = ? ORDER BY GioHangId LIMIT 10001`,
                    ['GioHangId', 'FoodId', 'SizeId', 'Quantity', 'CreatedAt', 'UpdatedAt']],
                ['cartToppings', `SELECT t.GioHangToppingId, t.GioHangId, t.ToppingId, t.Quantity FROM GioHang_Topping t JOIN GioHang g ON g.GioHangId = t.GioHangId WHERE g.UserId = ? ORDER BY t.GioHangToppingId LIMIT 10001`,
                    ['GioHangToppingId', 'GioHangId', 'ToppingId', 'Quantity']],
                ['notifications', `SELECT NotificationId, Title, Body, Type, IsRead, RelatedOrderId, CreatedAt FROM Notifications WHERE UserId = ? ORDER BY NotificationId LIMIT 10001`,
                    ['NotificationId', 'Title', 'Body', 'Type', 'IsRead', 'RelatedOrderId', 'CreatedAt']],
                ['invoices', `SELECT i.InvoiceId, i.InvoiceCode, i.TableId, i.OrderId, i.DateCheckIn, i.DateCheckOut, i.TotalAmount FROM Invoice i JOIN Orders o ON o.OrderId = i.OrderId WHERE o.UserId = ? ORDER BY i.InvoiceId LIMIT 10001`,
                    ['InvoiceId', 'InvoiceCode', 'TableId', 'OrderId', 'DateCheckIn', 'DateCheckOut', 'TotalAmount']],
                ['invoiceItems', `SELECT d.InvoiceDetailId, d.InvoiceId, d.FoodId, d.Quantity, d.UnitPrice, d.LineTotal FROM InvoiceDetail d JOIN Invoice i ON i.InvoiceId = d.InvoiceId JOIN Orders o ON o.OrderId = i.OrderId WHERE o.UserId = ? ORDER BY d.InvoiceDetailId LIMIT 10001`,
                    ['InvoiceDetailId', 'InvoiceId', 'FoodId', 'Quantity', 'UnitPrice', 'LineTotal']],
            ];
            for (const [name, sql, keys] of definitions) {
                const [rows] = await connection.execute(sql, [userId]);
                if (rows.length > MAX_EXPORT_ROWS) deny(413, 'EXPORT_TOO_LARGE', 'Dữ liệu quá lớn để xuất trong ứng dụng. Cần xuất có phân trang qua bộ phận vận hành.');
                const encryptedTable={addresses:'DeliveryAddresses',orders:'Orders',notifications:'Notifications'}[name];
                output[name] = rows.map(row => pick(encryptedTable ? revealRow(encryptedTable,row) : row, keys));
                if (Buffer.byteLength(JSON.stringify(output)) > MAX_EXPORT_BYTES) deny(413, 'EXPORT_TOO_LARGE', 'Dữ liệu quá lớn để xuất trong ứng dụng. Cần xuất có phân trang qua bộ phận vận hành.');
            }
            return output;
        });
        return result;
    }

    async function closeAccount(rawUserId, password) {
        const userId = id(rawUserId);
        if (typeof password !== 'string' || !password.length || Buffer.byteLength(password) > 256) deny(400, 'INVALID_PASSWORD', 'Vui lòng nhập mật khẩu hiện tại.');
        await withTransaction(pool, async connection => {
            // All account-changing/order-creation transactions must acquire this owner lock first.
            const [users] = await connection.execute('SELECT UserId, IsActive, PasswordHash FROM Users WHERE UserId = ? FOR UPDATE', [userId]);
            const user = users[0];
            if (!user || Number(user.IsActive) !== 1 || !await comparePassword(password, user.PasswordHash)) deny(401, 'REAUTHENTICATION_FAILED', 'Mật khẩu hiện tại không chính xác hoặc tài khoản không còn hoạt động.');
            const [activeOrders] = await connection.execute('SELECT OrderId FROM Orders WHERE UserId = ? AND StatusId IN (1, 2) FOR UPDATE', [userId]);
            if (activeOrders.length) deny(409, 'ACTIVE_ORDERS', 'Vui lòng hoàn tất hoặc xử lý các đơn hàng đang hoạt động trước khi đóng tài khoản.');
            const [unsettled] = await connection.execute(`SELECT p.OrderId FROM PaymentTransactions p JOIN Orders o ON o.OrderId = p.OrderId
                WHERE o.UserId = ? AND (p.State = 'pending' OR (p.State = 'paid' AND o.StatusId <> 3)) FOR UPDATE`, [userId]);
            if (unsettled.length) deny(409, 'UNSETTLED_PAYMENT', 'Tài khoản có giao dịch cần đối soát hoặc hoàn tiền. Vui lòng xử lý trước khi đóng tài khoản.');
            const anonymousId = random(16).toString('hex');
            const newPasswordHash = await hashPassword(random(32).toString('hex'), 10);
            const anonymousEmail=`closed-${anonymousId}@users.invalid`;
            const [closed] = await connection.execute(`UPDATE Users SET UserName = ?, Email = ?, EmailLookup = ?, PhoneLookup = NULL, PasswordHash = ?, Phone = NULL, Address = NULL,
                AvatarUrl = NULL, OTPCode = NULL, OTPHash = NULL, OTPAttempts = 0, OTPExpiry = NULL, IsActive = 0 WHERE UserId = ? AND IsActive = 1`,
            [sealField('Users',userId,'UserName','Tài khoản đã đóng'),sealField('Users',userId,'Email',anonymousEmail),userLookups({Email:anonymousEmail}).EmailLookup,newPasswordHash,userId]);
            if (closed.affectedRows !== 1) deny(409, 'ACCOUNT_CHANGED', 'Tài khoản đã thay đổi. Vui lòng thử lại.');
            const [oldOrders]=await connection.execute('SELECT OrderId FROM Orders WHERE UserId = ? FOR UPDATE',[userId]);
            for (const order of oldOrders) await connection.execute(`UPDATE Orders SET ReceiverName = ?, ReceiverPhone = ?, DeliveryAddress = ?, Note = NULL WHERE OrderId = ? AND UserId = ?`,
                [sealField('Orders',order.OrderId,'ReceiverName','Tài khoản đã đóng'),sealField('Orders',order.OrderId,'ReceiverPhone',''),sealField('Orders',order.OrderId,'DeliveryAddress','Đã xóa thông tin giao hàng'),order.OrderId,userId]);
            await connection.execute('DELETE t FROM GioHang_Topping t JOIN GioHang g ON g.GioHangId = t.GioHangId WHERE g.UserId = ?', [userId]);
            await connection.execute('DELETE FROM GioHang WHERE UserId = ?', [userId]);
            await connection.execute('DELETE FROM DeliveryAddresses WHERE UserId = ?', [userId]);
            await connection.execute('DELETE FROM Notifications WHERE UserId = ?', [userId]);
            // Orders/details, invoice totals and gateway references remain for accounting/reconciliation.
            // The current Invoice/InvoiceDetail schema has no contact/name/address columns to scrub.
        });
        // Only after commit: deletion of static files cannot be rolled back with the database.
        let cleanup;
        try { cleanup = await cleanupAvatars(userId); }
        catch { console.error('Privacy avatar cleanup requires retry: AVATAR_CLEANUP_PENDING'); cleanup = { incomplete: true }; }
        return {
            closed: true,
            avatarCleanupPending: Boolean(cleanup?.incomplete),
            retained: ['Mã tài khoản và đơn hàng', 'Chi tiết món và số tiền', 'Tham chiếu thanh toán và hóa đơn'],
        };
    }
    return { exportData, closeAccount };
}
module.exports = { createPrivacyService, cleanupAvatarFiles, PrivacyError, MAX_EXPORT_ROWS, MAX_EXPORT_BYTES };
