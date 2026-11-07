const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const http=require('node:http');
const express=require('express');
const sharp=require('sharp');
process.env.JWT_SECRET='access-validation-tests-private-secret-at-least-32';
process.env.VNP_TMN_CODE='TESTONLY';
process.env.VNP_HASH_SECRET='payment-test-only-private-key';
const auth=require('../src/config/auth');
const {createAuthMiddleware}=require('../src/middleware/authMiddleware');
const validation=require('../src/security/validation');
const orderSecurity=require('../src/services/orderSecurityService');
const {publicAsset,escapeHtml}=require('../src/security/output');
const {normalizeImage}=require('../src/middleware/avatarUpload');
const errors=require('../src/middleware/securityErrors');
const headers=require('../src/middleware/securityHeaders');

const goodOrder={paymentMethodId:1,receiverName:'Nguyễn Văn A',receiverPhone:'0901234567',deliveryAddress:'123 đường A',items:[{productId:1,quantity:2}]};
for(const [name,body] of [
    ['negative quantity',{...goodOrder,items:[{productId:1,quantity:-1}]}],
    ['fractional quantity',{...goodOrder,items:[{productId:1,quantity:1.5}]}],
    ['numeric string quantity',{...goodOrder,items:[{productId:1,quantity:'2'}]}],
    ['duplicate products',{...goodOrder,items:[{productId:1,quantity:2},{productId:'1',quantity:3}]}],
    ['empty cart',{...goodOrder,items:[]}],
    ['null item',{...goodOrder,items:[null]}],
    ['object identifier',{...goodOrder,items:[{productId:{id:1},quantity:1}]}],
    ['oversized cart',{...goodOrder,items:Array.from({length:51},(_,i)=>({productId:i+1,quantity:1}))}],
    ['spoofed user',{...goodOrder,userId:99}],
    ['spoofed role',{...goodOrder,role:'admin'}],
    ['spoofed payment method',{...goodOrder,paymentMethodId:2}],
    ['object receiver',{...goodOrder,receiverName:{name:'A'}}],
    ['oversized address',{...goodOrder,deliveryAddress:'x'.repeat(256)}],
]) test(`checkout rejects ${name}`,()=>assert.throws(()=>validation.schemas.order(body),{status:400}));

test('checkout strips display price and canonicalizes identifiers',()=>{
    const result=validation.schemas.order({...goodOrder,items:[{productId:'1',id:'display-id',quantity:2,price:1,name:'untrusted'}]});
    assert.deepEqual(result.items,[{productId:1,quantity:2}]);
});

test('auth/profile validation rejects malformed values, assignment of privileged fields and password truncation',()=>{
    for(const [schema,body] of [
        ['login',{email:['a@example.com'],password:'password'}],
        ['register',{userName:'Name',email:'test@example.com',password:'x'.repeat(73)}],
        ['profile',{name:'Name',IsActive:1}],
        ['profile',{address:{value:'address'}}],
        ['otp',{email:'test@example.com',otp:123456}],
        ['voucher',{code:'TEST',orderAmount:-1}],
        ['voucher',{code:'TEST',orderAmount:'100000'}],
    ]) assert.throws(()=>validation.schemas[schema](body),{status:400});
});

async function authenticate(token,user) {
    const req={headers:{authorization:`Bearer ${token}`}};
    const res={status(code){this.code=code;return this;},json(body){this.body=body;},set(){}};
    let passed=false;
    await createAuthMiddleware({getUser:async()=>{if(user instanceof Error) throw user;return user;}})(req,res,()=>{passed=true;});
    return {passed,code:res.code,req};
}
test('account lock, deletion and password change revoke existing JWTs on the next request',async()=>{
    const token=auth.signToken({userId:1,role:'admin'},'old-hash');
    const active=await authenticate(token,{UserId:1,IsActive:1,PasswordHash:'old-hash'});
    assert.equal(active.passed,true);assert.deepEqual(active.req.user,{userId:1});
    for(const user of [undefined,{UserId:1,IsActive:0,PasswordHash:'old-hash'},{UserId:1,IsActive:1,PasswordHash:'new-hash'}]) {
        const result=await authenticate(token,user);assert.equal(result.passed,false);assert.equal(result.code,401);
    }
    assert.equal((await authenticate(auth.signToken({userId:1}),{UserId:1,IsActive:1,PasswordHash:'old-hash'})).code,401);
    assert.equal((await authenticate(token,new Error('database-password'))).code,503);
    assert.equal((await authenticate(auth.signToken({userId:{id:1}},'old-hash'),{})).code,401);
});

test('server prices, stock locks and authenticated owner determine the order',async()=>{
    const calls=[];
    const c={execute:async(sql,args)=>{
        calls.push({sql,args});
        if(sql.startsWith('SELECT UserId, IsActive')) return [[{UserId:7,IsActive:1}]];
        if(sql.startsWith('SELECT FoodId')) return [[{FoodId:1,BasePrice:'25000.00',Stock:3,IsActive:1}]];
        if(sql.startsWith('INSERT INTO Orders')) return [{insertId:12}];
        return [{affectedRows:1}];
    }};
    const result=await orderSecurity.createOrder(c,7,validation.schemas.order({...goodOrder,items:[{productId:1,quantity:2,price:1}]}));
    assert.equal(result.totalAmount,50000);
    assert.match(calls[0].sql,/FOR UPDATE/);
    const insert=calls.find(c=>c.sql.startsWith('INSERT INTO Orders'));
    assert.equal(insert.args[1],7);assert.equal(insert.args[2],50000);assert.equal(insert.args[3],1);
    assert.match(calls.find(c=>c.sql.startsWith('UPDATE Food')).sql,/Stock >= \?/);
});

test('server fixes reservation deposit and ignores client amount',async()=>{
    const c={execute:async(sql)=>sql.startsWith('SELECT UserId, IsActive') ? [[{UserId:7,IsActive:1}]] : [{insertId:1,affectedRows:1}]};
    const input=validation.schemas.payment({type:'reservation',amount:1});
    assert.equal((await orderSecurity.createOrder(c,7,input)).totalAmount,100000);
});

test('inactive product and concurrent stock loss cannot create a successful checkout',async()=>{
    for(const active of [0,1]) {
        const c={execute:async(sql)=>{
            if(sql.startsWith('SELECT UserId, IsActive')) return [[{UserId:7,IsActive:1}]];
            if(sql.startsWith('SELECT FoodId'))return [[{FoodId:1,BasePrice:25000,Stock:2,IsActive:active}]];
            if(sql.startsWith('INSERT INTO Orders'))return [{insertId:1}];
            return [{affectedRows:0}];
        }};
        await assert.rejects(orderSecurity.createOrder(c,7,validation.schemas.order(goodOrder)));
    }
});

test('transaction releases and rolls back on failure, including connection acquisition failure',async()=>{
    const steps=[];
    const c={beginTransaction:async()=>steps.push('begin'),commit:async()=>steps.push('commit'),rollback:async()=>steps.push('rollback'),release:()=>steps.push('release')};
    await assert.rejects(orderSecurity.transaction({getConnection:async()=>c},async()=>{throw new Error('failed');}));
    assert.deepEqual(steps,['begin','rollback','release']);
    await assert.rejects(orderSecurity.transaction({getConnection:async()=>{throw new Error('unavailable');}},async()=>{}));
});

function cancellationDb({owner=7,state=1,paid=false}={}) {
    let restores=0;
    const c={execute:async(sql,args)=>{
        if(sql.startsWith('SELECT OrderId,OrderCode')) {
            assert.match(sql,/UserId = \? FOR UPDATE/);
            return [[...(args[1]===owner ? [{OrderId:12,OrderCode:'ORDTEST',StatusId:state,PaymentMethodId:paid?2:1}] : [])]];
        }
        if(sql.startsWith('SELECT State'))return [[{State:'paid'}]];
        if(sql.startsWith('UPDATE Orders')){state=4;return [{affectedRows:1}];}
        if(sql.startsWith('SELECT FoodId,Quantity'))return [[{FoodId:1,Quantity:2}]];
        if(sql.startsWith('UPDATE Food'))restores++;
        return [{affectedRows:1}];
    }};
    return {c,restores:()=>restores};
}
test('order cancellation rejects another owner and paid orders; replay restores stock only once',async()=>{
    let db=cancellationDb();
    await assert.rejects(orderSecurity.cancelOrder(db.c,9,12),{status:404});assert.equal(db.restores(),0);
    await orderSecurity.cancelOrder(db.c,7,12);assert.equal(db.restores(),1);
    await assert.rejects(orderSecurity.cancelOrder(db.c,7,12),{status:409});assert.equal(db.restores(),1);
    db=cancellationDb({paid:true});await assert.rejects(orderSecurity.cancelOrder(db.c,7,12),{status:409});assert.equal(db.restores(),0);
});

function paymentDb() {
    let state='pending',restores=0,writes=0;
    const c={execute:async(sql,args)=>{
        if(sql.startsWith('SELECT OrderId,TotalAmount'))return [[{OrderId:12,TotalAmount:'50000.00',StatusId:1,PaymentMethodId:2}]];
        if(sql.startsWith('SELECT State'))return [[{State:state}]];
        if(sql.startsWith('UPDATE PaymentTransactions')){state=args[0];writes++;}
        if(sql.startsWith('SELECT FoodId,Quantity'))return [[{FoodId:1,Quantity:2}]];
        if(sql.startsWith('UPDATE Food'))restores++;
        return [{affectedRows:1}];
    }};
    return {c,state:()=>state,restores:()=>restores,writes:()=>writes};
}
const query={vnp_TmnCode:'TESTONLY',vnp_TxnRef:'ORDTEST',vnp_Amount:'5000000',vnp_TransactionStatus:'00',vnp_TransactionNo:'123'};
test('payment rejects unsigned, wrong-merchant and wrong-amount callbacks without state changes',async()=>{
    for(const [q,verified,expected] of [[query,false,'97'],[{...query,vnp_TmnCode:'OTHER'},true,'97'],[{...query,vnp_Amount:'100'},true,'04']]) {
        const db=paymentDb();const result=await orderSecurity.confirmPayment(db.c,q,{isVerified:verified,isSuccess:true},'TESTONLY');
        assert.equal(result.RspCode,expected);assert.equal(db.writes(),0);assert.equal(db.restores(),0);
    }
});
test('successful payment is final; replay or a later failure cannot cancel a paid order',async()=>{
    const db=paymentDb();
    assert.equal((await orderSecurity.confirmPayment(db.c,query,{isVerified:true,isSuccess:true},'TESTONLY')).RspCode,'00');
    assert.equal(db.state(),'paid');
    assert.equal((await orderSecurity.confirmPayment(db.c,query,{isVerified:true,isSuccess:false},'TESTONLY')).RspCode,'02');
    assert.equal(db.state(),'paid');assert.equal(db.writes(),1);assert.equal(db.restores(),0);
});
test('failed payment restores stock once and ignores repeated callbacks',async()=>{
    const db=paymentDb();
    const verify={isVerified:true,isSuccess:false};
    await orderSecurity.confirmPayment(db.c,query,verify,'TESTONLY');
    await orderSecurity.confirmPayment(db.c,query,verify,'TESTONLY');
    assert.equal(db.state(),'failed');assert.equal(db.restores(),1);
});

test('avatar is decoded and reencoded; HTML masquerading as an image and SVG are rejected',async()=>{
    const input=await sharp({create:{width:2,height:2,channels:3,background:'#ff0000'}}).png().toBuffer();
    const result=await normalizeImage(input);
    assert.equal((await sharp(result).metadata()).format,'webp');
    for(const content of ['<script>alert(1)</script>','<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>']) await assert.rejects(normalizeImage(Buffer.from(content)));
    const large=await sharp({create:{width:4001,height:4001,channels:3,background:'red'}}).png().toBuffer();
    await assert.rejects(normalizeImage(large));
});

test('output escapes HTML and rejects external or traversal asset paths',()=>{
    const req={headers:{host:'attacker.example', 'x-forwarded-proto':'https'}};
    assert.match(publicAsset(req,'/avatars/a.webp'),/^http:\/\/localhost:/);
    for(const p of ['https://attacker.example/a.png','/avatars/../../.env','/avatars/<svg>.png']) assert.equal(publicAsset(req,p),null);
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

// Controllers run against a fake pool so HTTP security tests never modify the real database.
let dbCalls=[];
let customDb=null;
const fakePool={execute:async(sql,args)=>{
    dbCalls.push({sql,args});
    if(customDb) return customDb(sql,args);
    if(sql.startsWith('SELECT UserId, IsActive'))return [[{UserId:7,IsActive:1,PasswordHash:'test-hash'}]];
    if(sql.includes('WHERE o.OrderId = ? AND o.UserId = ?')) return [[]];
    throw new Error('Unexpected database call');
}};
fakePool.getConnection=async()=>({execute:fakePool.execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}});
require.cache[require.resolve('../src/config/db')]={id:require.resolve('../src/config/db'),filename:require.resolve('../src/config/db'),loaded:true,exports:fakePool};

async function server(t) {
    const app=express();app.use(headers);app.use(express.json({limit:'1kb'}));
    app.use('/api/orders',require('../src/routes/orderRoutes'));
    app.use('/api/food', (req,res,next)=>{if(req.path==='/') return validation.foodQuery(req,res,next);next();}, (req,res)=>res.json({ok:true}));
    app.use('/api/vnpay',require('../src/routes/vnpayRoutes'));
    app.post('/validate',validation.validate('profile'),(req,res)=>res.json(req.body));
    app.use(errors);
    const s=http.createServer(app);
    await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
    t.after(async()=>{s.closeAllConnections();await new Promise(resolve=>s.close(resolve));});
    return {base:`http://127.0.0.1:${s.address().port}`,token:auth.signToken({userId:7},'test-hash')};
}
test('HTTP enforces login, object ownership, pagination, malformed JSON and bounded payloads',async t=>{
    const {base,token}=await server(t);dbCalls=[];
    assert.equal((await fetch(base+'/api/orders/12')).status,401);
    assert.equal((await fetch(base+'/api/orders/12',{headers:{Authorization:`Bearer ${token}`}})).status,404);
    const query=dbCalls.find(c=>c.sql.includes('WHERE o.OrderId = ? AND o.UserId = ?'));
    assert.deepEqual(query.args,['12',7]);
    assert.equal((await fetch(base+'/api/orders/not-an-id',{headers:{Authorization:`Bearer ${token}`}})).status,400);
    for(const query of ['limit=-1','limit=101','page=1abc','search[x]=hello','page=2&page=3']) assert.equal((await fetch(base+'/api/food?'+query)).status,400);
    const bad=await fetch(base+'/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});
    assert.equal(bad.status,400);assert.ok(!(await bad.text()).includes('SyntaxError'));
    assert.equal((await fetch(base+'/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'x'.repeat(2000)})})).status,413);
});
test('HTTP unsigned VNPay return never updates an order or reflects injected markup',async t=>{
    const {base}=await server(t);dbCalls=[];
    const query=new URLSearchParams({vnp_TxnRef:'ORDTEST',vnp_Amount:'5000000',vnp_SecureHash:'0'.repeat(128),vnp_TmnCode:'TESTONLY',vnp_ResponseCode:'24'});
    const response=await fetch(base+'/api/vnpay/return?'+query);
    assert.equal(response.status,400);assert.equal(dbCalls.length,0);
    query.set('vnp_TxnRef','<script>alert(1)</script>');
    const injected=await fetch(base+'/api/vnpay/return?'+query);
    assert.equal(injected.status,400);assert.ok(!(await injected.text()).includes('<script>'));
});
test('HTTP signed browser return is display-only and cannot cancel a paid order',async t=>{
    const {base}=await server(t);dbCalls=[];
    const {buildPaymentUrlSearchParams}=require('vnpay');
    const q={...query,vnp_ResponseCode:'24'};
    const hash=createHmac('sha512',process.env.VNP_HASH_SECRET).update(buildPaymentUrlSearchParams(q).toString()).digest('hex');
    const response=await fetch(base+'/api/vnpay/return?'+new URLSearchParams({...q,vnp_SecureHash:hash}));
    // The fake database rejects reads here; any write would also be caught in dbCalls.
    assert.equal(response.status,400);
    assert.ok(dbCalls.some(c=>c.sql.startsWith('SELECT o.TotalAmount')));
    assert.ok(dbCalls.every(c=>c.sql.startsWith('SELECT')));
});


test('cart increment includes owner and atomically rejects concurrent stock or quantity overflow',async()=>{
    dbCalls=[];
    customDb=async(sql)=>{
        if(sql.startsWith('SELECT UserId, IsActive')) return [[{UserId:7,IsActive:1}]];
        if(sql.startsWith('SELECT FoodId')) return [[{FoodId:1,Stock:10,IsActive:1}]];
        if(sql.startsWith('SELECT GioHangId')) return [[{GioHangId:3,Quantity:1}]];
        if(sql.startsWith('UPDATE GioHang')) return [{affectedRows:0}];
        throw new Error('Unexpected query');
    };
    try {
        const res={status(code){this.code=code;return this;},json(body){this.body=body;}};
        await require('../src/controllers/cartController').addToCart({body:{productId:1,quantity:2},user:{userId:7}},res,(error)=>{res.code=error.status;});
        assert.equal(res.code,409);
        const update=dbCalls.find(c=>c.sql.startsWith('UPDATE GioHang'));
        assert.match(update.sql,/g.UserId = \?/);assert.match(update.sql,/LEAST\(99, f.Stock\)/);
        assert.deepEqual(update.args,[2,3,7,2]);
    } finally {customDb=null;}
});


test('checkout refuses a closed account before inventory reads or writes',async()=>{
    const queries=[];
    const c={execute:async(sql)=>{queries.push(sql);return [[{UserId:7,IsActive:0}]];}};
    await assert.rejects(orderSecurity.createOrder(c,7,validation.schemas.order(goodOrder)),{status:401});
    assert.equal(queries.length,1);
    assert.match(queries[0],/FROM Users .*FOR UPDATE/);
});
