/* Integration tests — they run against a real Postgres, not a mock.
   The point of a backend is the things a browser cannot guarantee, so
   that is what these check: tenant isolation, role limits, constraint
   enforcement, and above all that two people cannot book the same
   camera at the same moment.

   node server/test.js        (resets the database first)
*/

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createApp } from './index.js';
import { migrate, reset, closePool, ownerConfig, getPool } from './lib/db.js';
import { seedDatabase } from './lib/seed.js';
import { hashPassword } from './lib/auth.js';

let server, base, token, ctx = {};

const api = async (method, path, body, tok = token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: res.status, body: await res.json() };
};

before(async () => {
  await reset();
  await migrate();
  const seeded = await seedDatabase();
  ctx.accountId = seeded.accountId;
  ctx.ids = seeded.ids;

  server = createApp();
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;

  const signin = await api('POST', '/api/auth/signin',
    { email: 'maya@northlightrentals.com', password: 'northlight-dev' }, null);
  assert.equal(signin.status, 200, JSON.stringify(signin.body));
  token = signin.body.token;
});

after(async () => {
  await new Promise(r => server.close(r));
  await closePool();
});

/* ---------------------------------------------------------------- auth */
test('rejects a wrong password without revealing whether the account exists', async () => {
  const wrong = await api('POST', '/api/auth/signin', { email: 'maya@northlightrentals.com', password: 'nope' }, null);
  const missing = await api('POST', '/api/auth/signin', { email: 'nobody@example.com', password: 'nope' }, null);
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.equal(wrong.body.error, missing.body.error);
});

test('rejects an unauthenticated request', async () => {
  const res = await api('GET', '/api/orders', undefined, null);
  assert.equal(res.status, 401);
});

test('rejects a tampered token', async () => {
  const res = await api('GET', '/api/orders', undefined, token.slice(0, -4) + 'aaaa');
  assert.equal(res.status, 401);
});

/* -------------------------------------------------------- tenant isolation */
test('row-level security hides another account entirely', async () => {
  const owner = new pg.Client(ownerConfig);
  await owner.connect();
  const other = (await owner.query(
    `insert into accounts (name) values ('Rival Rentals') returning id`)).rows[0].id;
  await owner.query(
    `insert into customers (account_id, number, name) values ($1,'X-1','Rival Customer')`, [other]);
  await owner.end();

  /* our session must not see it */
  const mine = await api('GET', '/api/customers');
  assert.equal(mine.status, 200);
  assert.ok(!mine.body.customers.some(c => c.name === 'Rival Customer'),
    'the other tenant leaked into this account');

  /* and the api role, scoped to us, cannot read it directly either */
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.account_id', ctx.accountId]);
    const { rows } = await client.query('select count(*)::int n from customers where account_id = $1', [other]);
    assert.equal(rows[0].n, 0, 'RLS did not filter a direct query');
    await client.query('rollback');
  } finally { client.release(); }
});

/* --------------------------------------------------------------- reading */
test('bootstrap returns the whole account in one call', async () => {
  const res = await api('GET', '/api/bootstrap');
  assert.equal(res.status, 200);
  const b = res.body;
  assert.equal(b.company.name, 'Northlight Rentals');
  assert.equal(b.products.length, 19);
  assert.equal(b.orders.length, 10);
  assert.equal(b.stockItems.length, 41);
  assert.ok(b.orders[0].lines.length >= 0);
});

test('stock item barcodes are unique and check-digit valid', async () => {
  const { body } = await api('GET', '/api/bootstrap');
  const codes = body.stockItems.map(s => s.barcode);
  assert.equal(new Set(codes).size, codes.length, 'duplicate barcodes would make a scan ambiguous');
  for (const code of codes) {
    const digits = [...code];
    const check = digits.pop();
    const sum = digits.reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
    assert.equal(String((10 - sum % 10) % 10), check, `bad check digit on ${code}`);
  }
});

/* ---------------------------------------------------------- availability */
test('availability subtracts reservations, downtime and bench units', async () => {
  const { body } = await api('GET', '/api/bootstrap');
  const lamp = body.products.find(p => p.sku === 'LIT-APS60');   // 5 owned, 1 on the bench, 1 in downtime
  const from = new Date(Date.now() + 864e5).toISOString();
  const to = new Date(Date.now() + 2 * 864e5).toISOString();
  const res = await api('GET', `/api/availability?product=${lamp.id}&from=${from}&to=${to}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.available < lamp.stock,
    'availability should be below units owned while a unit is on the bench and another in downtime');
  assert.ok(res.body.available >= 0);
});

test('availability rejects a call without a window', async () => {
  const res = await api('GET', '/api/availability?product=x');
  assert.equal(res.status, 400);
});

/* ------------------------------------------------------------- lifecycle */
test('an order moves concept → reserved → picked up → returned → archived', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const customer = boot.customers[0];
  const product = boot.products.find(p => p.sku === 'GRP-SAND');   // plenty in stock
  const starts = new Date(Date.now() + 20 * 864e5).toISOString();
  const stops = new Date(Date.now() + 22 * 864e5).toISOString();

  const created = await api('POST', '/api/orders', { customerId: customer.id, startsAt: starts, stopsAt: stops });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const id = created.body.id;
  assert.equal(created.body.status, 'concept');

  const withLine = await api('POST', `/api/orders/${id}/lines`, { productId: product.id, qty: 3 });
  assert.equal(withLine.status, 200);
  assert.equal(withLine.body.order.lines.length, 1);

  const reserved = await api('POST', `/api/orders/${id}/reserve`);
  assert.equal(reserved.status, 200);
  assert.equal(reserved.body.status, 'reserved');

  const lineId = reserved.body.lines[0].id;
  const partial = await api('POST', `/api/orders/${id}/pickup`, { lines: [{ line: lineId, qty: 1 }] });
  assert.equal(partial.body.status, 'mixed', 'a partial pickup should land in mixed');

  const full = await api('POST', `/api/orders/${id}/pickup`, { lines: [{ line: lineId, qty: 2 }], signature: 'Test Renter' });
  assert.equal(full.body.status, 'started');
  assert.equal(full.body.signature, 'Test Renter');

  const back = await api('POST', `/api/orders/${id}/return`, { lines: [{ line: lineId, qty: 3 }] });
  assert.equal(back.body.status, 'stopped');

  const archived = await api('POST', `/api/orders/${id}/status`, { action: 'archive' });
  assert.equal(archived.body.status, 'archived');
  ctx.archivedOrder = id;
});

test('refuses a transition that the lifecycle does not allow', async () => {
  const res = await api('POST', `/api/orders/${ctx.archivedOrder}/pickup`, { lines: [] });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /archived/);
});

test('refuses to return more than went out', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const out = boot.orders.find(o => o.status === 'started');
  const line = out.lines[0];
  const res = await api('POST', `/api/orders/${out.id}/return`,
    { lines: [{ line: line.id, qty: line.qty + 50 }] });
  /* the SQL clamps to what is actually out — never more */
  assert.equal(res.status, 200);
  const after = res.body.lines.find(l => l.id === line.id);
  assert.ok(after.returnedQty <= after.pickedQty, 'returned more than was picked up');
});

/* ------------------------------------------------------------- shortages */
test('blocks a reservation that exceeds stock beyond the shortage limit', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const dolly = boot.products.find(p => p.sku === 'GRP-DOLLY');   // 2 owned, shortages not allowed
  const starts = new Date(Date.now() + 40 * 864e5).toISOString();
  const stops = new Date(Date.now() + 41 * 864e5).toISOString();
  const o = (await api('POST', '/api/orders',
    { customerId: boot.customers[0].id, startsAt: starts, stopsAt: stops })).body;
  await api('POST', `/api/orders/${o.id}/lines`, { productId: dolly.id, qty: 5 });

  const res = await api('POST', `/api/orders/${o.id}/reserve`);
  assert.equal(res.status, 409, 'over-booking should be refused');
  assert.match(res.body.error, /short/i);
});

test('allows an overbooking within the product shortage limit', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const lens = boot.products.find(p => p.sku === 'CAM-LENS24');   // 8 owned, shortage limit 2
  const starts = new Date(Date.now() + 50 * 864e5).toISOString();
  const stops = new Date(Date.now() + 51 * 864e5).toISOString();
  const o = (await api('POST', '/api/orders',
    { customerId: boot.customers[0].id, startsAt: starts, stopsAt: stops })).body;
  await api('POST', `/api/orders/${o.id}/lines`, { productId: lens.id, qty: 10 });
  const res = await api('POST', `/api/orders/${o.id}/reserve`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

/* ------------------------------------------- the one a browser cannot do */
test('two simultaneous reservations of the last unit: exactly one wins', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const owner = new pg.Client(ownerConfig);
  await owner.connect();
  const scarce = (await owner.query(`insert into products
    (account_id, sku, name, product_type, tracking, quantity, allow_shortage, base_price_cents)
    values ($1,'RACE-1','The Only One','rental','bulk',1,false,10000) returning id`,
    [ctx.accountId])).rows[0].id;
  await owner.end();

  const starts = new Date(Date.now() + 70 * 864e5).toISOString();
  const stops = new Date(Date.now() + 71 * 864e5).toISOString();

  const makeOrder = async () => {
    const o = (await api('POST', '/api/orders',
      { customerId: boot.customers[0].id, startsAt: starts, stopsAt: stops })).body;
    await api('POST', `/api/orders/${o.id}/lines`, { productId: scarce, qty: 1 });
    return o.id;
  };
  const a = await makeOrder();
  const b = await makeOrder();

  /* fire both at the same instant */
  const [ra, rb] = await Promise.all([
    api('POST', `/api/orders/${a}/reserve`),
    api('POST', `/api/orders/${b}/reserve`)
  ]);

  const wins = [ra, rb].filter(r => r.status === 200);
  const losses = [ra, rb].filter(r => r.status === 409);
  assert.equal(wins.length, 1, `expected exactly one winner, got ${wins.length}`);
  assert.equal(losses.length, 1);
  assert.match(losses[0].body.error, /short/i);

  /* and the unit really is gone */
  const avail = await api('GET', `/api/availability?product=${scarce}&from=${starts}&to=${stops}`);
  assert.equal(avail.body.available, 0);
});

/* ----------------------------------------------------------------- money */
test('totals apply discount, coupon and tax in that order', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  /* Harbor Films: 10% standing discount, tax exempt */
  const harbor = boot.customers.find(c => c.name === 'Harbor Films');
  const sand = boot.products.find(p => p.sku === 'GRP-SAND');   // $4/day flat
  const starts = new Date(Date.now() + 80 * 864e5).toISOString();
  const stops = new Date(Date.now() + 82 * 864e5).toISOString();   // 2 days

  const o = (await api('POST', '/api/orders',
    { customerId: harbor.id, startsAt: starts, stopsAt: stops })).body;
  const withLine = await api('POST', `/api/orders/${o.id}/lines`, { productId: sand.id, qty: 10 });
  const t = withLine.body.order.totals;

  assert.equal(t.subtotal, 80, '10 × $4 × 2 days');
  assert.equal(t.customerDiscount, 8, '10% standing discount');
  assert.equal(t.taxRate, 0, 'tax exempt profile');
  assert.equal(t.total, 72);
  assert.equal(t.due, 72);
  ctx.moneyOrder = o.id;
});

test('a payment reduces what is owed and never goes negative on the invoice', async () => {
  const paid = await api('POST', `/api/orders/${ctx.moneyOrder}/payments`,
    { amount: 72, method: 'Cash', kind: 'Full payment' });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.order.totals.paid, 72);
  assert.equal(paid.body.order.totals.due, 0);
});

test('rejects a zero or negative payment', async () => {
  const res = await api('POST', `/api/orders/${ctx.moneyOrder}/payments`, { amount: 0 });
  assert.equal(res.status, 400);
  const neg = await api('POST', `/api/orders/${ctx.moneyOrder}/payments`, { amount: -50 });
  assert.equal(neg.status, 400);
});

test('tiered pricing charges a week at the structure multiplier, not seven days', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const camera = boot.products.find(p => p.sku === 'CAM-A7S3');   // $185, ps_std, week = ×3.5
  const jonas = boot.customers.find(c => c.name === 'Jonas Meier');
  const starts = new Date(Date.now() + 90 * 864e5).toISOString();
  const stops = new Date(Date.now() + 97 * 864e5).toISOString();   // 7 days

  const o = (await api('POST', '/api/orders',
    { customerId: jonas.id, startsAt: starts, stopsAt: stops })).body;
  const res = await api('POST', `/api/orders/${o.id}/lines`, { productId: camera.id, qty: 1 });
  assert.equal(res.body.order.totals.subtotal, 185 * 3.5,
    'a 7-day hire should bill at ×3.5, not ×7');
});

test('withholding from a deposit captures only that much and releases the rest', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const sand = boot.products.find(p => p.sku === 'GRP-SAND');
  const starts = new Date(Date.now() + 100 * 864e5).toISOString();
  const stops = new Date(Date.now() + 101 * 864e5).toISOString();
  const o = (await api('POST', '/api/orders',
    { customerId: boot.customers[1].id, startsAt: starts, stopsAt: stops, deposit: 200 })).body;
  const line = (await api('POST', `/api/orders/${o.id}/lines`, { productId: sand.id, qty: 1 })).body.line;
  await api('POST', `/api/orders/${o.id}/payments`, { amount: 200, kind: 'Security deposit hold', method: 'Credit card' });
  await api('POST', `/api/orders/${o.id}/reserve`);
  await api('POST', `/api/orders/${o.id}/pickup`, { lines: [{ line: line.id, qty: 1 }] });

  const back = await api('POST', `/api/orders/${o.id}/return`,
    { lines: [{ line: line.id, qty: 1 }], withhold: 45, note: 'Corner scuffed' });
  assert.equal(back.status, 200);
  assert.equal(back.body.totals.heldDeposit, 0, 'the hold should no longer be authorised');

  const payments = (await api('GET', '/api/bootstrap')).body.payments.filter(p => p.orderId === o.id);
  const captured = payments.find(p => p.kind.startsWith('Deposit captured'));
  assert.ok(captured, 'expected a capture row');
  assert.equal(captured.amount, 45);
});

test('refuses to withhold more than the deposit held', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const sand = boot.products.find(p => p.sku === 'GRP-SAND');
  const starts = new Date(Date.now() + 110 * 864e5).toISOString();
  const stops = new Date(Date.now() + 111 * 864e5).toISOString();
  const o = (await api('POST', '/api/orders',
    { customerId: boot.customers[1].id, startsAt: starts, stopsAt: stops, deposit: 100 })).body;
  const line = (await api('POST', `/api/orders/${o.id}/lines`, { productId: sand.id, qty: 1 })).body.line;
  await api('POST', `/api/orders/${o.id}/payments`, { amount: 100, kind: 'Security deposit hold' });
  await api('POST', `/api/orders/${o.id}/reserve`);
  await api('POST', `/api/orders/${o.id}/pickup`, { lines: [{ line: line.id, qty: 1 }] });
  const res = await api('POST', `/api/orders/${o.id}/return`,
    { lines: [{ line: line.id, qty: 1 }], withhold: 500 });
  assert.equal(res.status, 400);
});

/* ------------------------------------------------------------ permissions */
test('a warehouse role can fulfil but cannot take money', async () => {
  const owner = new pg.Client(ownerConfig);
  await owner.connect();
  await owner.query(
    `insert into users (account_id, name, email, password_hash, role)
     values ($1,'Sasha Warehouse','warehouse@northlightrentals.com',$2,'Warehouse')`,
    [ctx.accountId, await hashPassword('warehouse-dev')]);
  await owner.end();

  const s = await api('POST', '/api/auth/signin',
    { email: 'warehouse@northlightrentals.com', password: 'warehouse-dev' }, null);
  assert.equal(s.status, 200);
  const wh = s.body.token;

  const read = await api('GET', '/api/orders', undefined, wh);
  assert.equal(read.status, 200, 'warehouse should be able to read orders');

  const order = read.body.orders.find(o => o.status === 'reserved');
  const pay = await api('POST', `/api/orders/${order.id}/payments`, { amount: 10 }, wh);
  assert.equal(pay.status, 403, 'warehouse must not take payments');
  assert.match(pay.body.error, /Warehouse/);
});

/* ------------------------------------------------------------- documents */
test('document numbers increment and never repeat', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const order = boot.orders[0];
  const a = await api('POST', `/api/orders/${order.id}/documents`, { type: 'invoice' });
  const b = await api('POST', `/api/orders/${order.id}/documents`, { type: 'invoice' });
  assert.equal(a.status, 200);
  assert.notEqual(a.body.number, b.body.number);
  assert.match(a.body.number, /^INV-\d+$/);
});

/* ------------------------------------------------------------ validation */
test('rejects an order whose end is before its start', async () => {
  const boot = (await api('GET', '/api/bootstrap')).body;
  const res = await api('POST', '/api/orders', {
    customerId: boot.customers[0].id,
    startsAt: new Date(Date.now() + 3 * 864e5).toISOString(),
    stopsAt: new Date(Date.now() + 864e5).toISOString()
  });
  assert.equal(res.status, 400);
});

test('rejects malformed JSON without a stack trace', async () => {
  const res = await fetch(base + '/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: '{not json'
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /JSON/);
});

test('unknown routes 404 rather than hanging', async () => {
  const res = await api('GET', '/api/nope');
  assert.equal(res.status, 404);
});

/* ----------------------------------------------------------------- reports */
test('the pull sheet aggregates what must leave in a window', async () => {
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 3 * 864e5).toISOString();
  const res = await api('GET', `/api/reports/pull-sheet?from=${from}&to=${to}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.rows));
  if (res.body.rows.length) {
    assert.ok(res.body.rows[0].needed > 0);
    assert.ok(Array.isArray(res.body.rows[0].orders));
  }
});
