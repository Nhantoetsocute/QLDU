const test = require('node:test');
const assert = require('node:assert/strict');

let calls = [];
let accountActive = true;
const connection = {
    beginTransaction: async () => calls.push({ operation: 'begin' }),
    commit: async () => calls.push({ operation: 'commit' }),
    rollback: async () => calls.push({ operation: 'rollback' }),
    release: () => calls.push({ operation: 'release' }),
    execute: async (sql, args) => {
        calls.push({ operation: 'query', sql, args });
        if (sql.startsWith('SELECT UserId, IsActive')) return [[{ UserId: 7, IsActive: accountActive ? 1 : 0 }]];
        if (sql.startsWith('SELECT FoodId')) return [[{ FoodId: 1, Stock: 20, IsActive: 1 }]];
        if (sql.startsWith('SELECT GioHangId')) return [[{ GioHangId: 3, Quantity: 1 }]];
        return [{ affectedRows: 1 }];
    },
};
const pool = {
    getConnection: async () => connection,
    execute: async () => { throw new Error('Mutation escaped transaction'); },
};
const dbFile = require.resolve('../src/config/db');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: pool };
const controller = require('../src/controllers/cartController');

async function run(handler, body = {}) {
    let failure;
    const response = {
        status(code) { this.code = code; return this; },
        json(result) { this.result = result; },
    };
    await controller[handler]({ user: { userId: 7 }, params: { id: '3' }, body }, response, (error) => { failure = error; });
    return { response, failure };
}

for (const [handler, body] of [
    ['addToCart', { productId: 1, quantity: 2 }],
    ['updateCartItem', { quantity: 2 }],
    ['removeFromCart', {}],
    ['clearCart', {}],
]) {
    test(`${handler} locks account first and commits its owner-bound mutation`, async () => {
        calls = [];
        accountActive = true;
        const { response, failure } = await run(handler, body);
        assert.equal(failure, undefined);
        assert.ok(response.result?.message);
        assert.equal(calls[0].operation, 'begin');
        const queries = calls.filter((call) => call.operation === 'query');
        assert.equal(queries[0].sql, 'SELECT UserId, IsActive FROM Users WHERE UserId = ? FOR UPDATE');
        assert.deepEqual(queries[0].args, [7]);
        const mutations = queries.filter((call) => /^(INSERT|UPDATE|DELETE)/.test(call.sql));
        assert.equal(mutations.length, 1);
        assert.ok(mutations[0].args.includes(7));
        assert.deepEqual(calls.slice(-2).map((call) => call.operation), ['commit', 'release']);
        assert.ok(!calls.some((call) => call.operation === 'rollback'));
    });

    test(`${handler} cannot recreate cart data after account closure`, async () => {
        calls = [];
        accountActive = false;
        const { response, failure } = await run(handler, body);
        assert.equal(failure?.status, 401);
        assert.equal(response.result, undefined);
        const queries = calls.filter((call) => call.operation === 'query');
        assert.equal(queries.length, 1);
        assert.match(queries[0].sql, /FROM Users.*FOR UPDATE/);
        assert.deepEqual(calls.slice(-2).map((call) => call.operation), ['rollback', 'release']);
        assert.ok(!calls.some((call) => call.operation === 'commit'));
    });
}
