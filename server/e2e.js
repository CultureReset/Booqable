/* End-to-end: the real front-end adapter against the real backend.

   Proves the seam the whole architecture rests on — that swapping
   MemoryAdapter for ApiAdapter moves the app onto Postgres without any
   screen changing — and that a refusal from the server (the last unit
   just went) actually reaches the caller.

   node server/e2e.js
*/

import assert from 'node:assert/strict';
import { createApp } from './index.js';
import { reset, migrate, closePool, ownerConfig } from './lib/db.js';
import { seedDatabase } from './lib/seed.js';
import { ApiAdapter } from '../src/core/adapters/api.js';
import { Store } from '../src/core/store.js';
import { Registry } from '../src/core/registry.js';
import { registerCoreFieldTypes } from '../src/core/fields.js';
import { registerEntities } from '../src/schema/entities.js';
import { registerPricingStrategies, registerMoneySteps, orderTotals } from '../src/schema/pricing.js';
import { registerAvailabilityRules, availableQty } from '../src/schema/availability.js';
import { registerDocumentTypes } from '../src/schema/documents.js';
import { registerSettingsPanels } from '../src/schema/settings.js';
import { Lifecycle, totalItems } from '../src/schema/lifecycle.js';
import { Data } from '../src/core/store.js';
import pg from 'pg';

const results = [];
const check = (name, fn) => results.push({ name, fn });
const run = async () => {
  let pass = 0, fail = 0;
  for (const { name, fn } of results) {
    try { await fn(); console.log(`ok   ${name}`); pass++; }
    catch (err) { console.log(`FAIL ${name}\n     ${err.message}`); fail++; }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail;
};

console.log('preparing database…');
await reset();
await migrate();
await seedDatabase();

const server = createApp();
await new Promise(r => server.listen(0, r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
console.log(`api on ${baseUrl}\n`);

/* boot the front-end domain exactly as main.js does */
registerCoreFieldTypes();
registerPricingStrategies();
registerMoneySteps();
registerAvailabilityRules();
registerDocumentTypes();

const api = ApiAdapter({ baseUrl });
await api.signIn('maya@northlightrentals.com', 'northlight-dev');
await api.prime();
Store.init(api);
registerEntities();
registerSettingsPanels();

check('the app is running on Postgres, not memory', () => {
  assert.equal(Store.adapterName(), 'postgres-api');
});

check('every collection the screens read is populated from the database', () => {
  for (const [name, min] of [['orders', 10], ['products', 19], ['customers', 6],
                             ['stockItems', 41], ['locations', 3], ['documents', 13]]) {
    assert.ok(Store.all(name).length >= min, `${name} has ${Store.all(name).length}, expected >= ${min}`);
  }
  assert.equal(Data.company().name, 'Northlight Rentals');
});

check('the client pricing pipeline agrees with the server total', async () => {
  const order = Data.orders().find(o => o.lines.length && o.status !== 'canceled');
  const clientTotal = orderTotals(order).total;
  const res = await fetch(`${baseUrl}/api/orders/${order.id}`, {
    headers: { authorization: `Bearer ${api.token()}` }
  });
  const serverTotal = (await res.json()).totals.total;
  assert.ok(Math.abs(clientTotal - serverTotal) < 0.01,
    `client ${clientTotal} vs server ${serverTotal} on order #${order.number}`);
});

check('the client availability engine agrees with the database', async () => {
  const product = Data.products().find(p => p.sku === 'CAM-A7S3');
  const from = new Date(Date.now() + 3 * 864e5).toISOString();
  const to = new Date(Date.now() + 4 * 864e5).toISOString();
  const client = availableQty(product.id, from, to);
  const server = await api.availability(product.id, from, to);
  assert.equal(client, server, `client ${client} vs server ${server} for ${product.sku}`);
});

check('reserving through the adapter updates the cached order', async () => {
  const concept = Data.orders().find(o => o.status === 'concept' && o.lines.length);
  const before = concept.status;
  await api.reserve(concept.id);
  assert.equal(before, 'concept');
  assert.equal(Data.order(concept.id).status, 'reserved', 'the cache did not absorb the server response');
});

check('a full pickup and return round-trip lands in the right states', async () => {
  const order = Data.orders().find(o => o.status === 'reserved' && o.lines.length);
  const lines = order.lines.map(l => ({ line: l.id, qty: l.qty }));
  await api.pickup(order.id, lines, 'E2E Renter');
  assert.equal(Data.order(order.id).status, 'started');
  assert.equal(Data.order(order.id).signature, 'E2E Renter');
  await api.returnItems(order.id, lines);
  assert.equal(Data.order(order.id).status, 'stopped');
  assert.equal(totalItems(Data.order(order.id)) > 0, true);
});

check('the lifecycle config and the database enum describe the same states', async () => {
  const owner = new pg.Client(ownerConfig);
  await owner.connect();
  const { rows } = await owner.query(
    `select unnest(enum_range(null::order_status))::text as s`);
  await owner.end();
  const db = rows.map(r => r.s).sort();
  const client = Object.keys(Lifecycle.states).filter(s => s !== 'new').sort();
  assert.deepEqual(db, client, 'the state machine and the enum have drifted apart');
});

check('a server refusal reaches the caller instead of being swallowed', async () => {
  const owner = new pg.Client(ownerConfig);
  await owner.connect();
  const accountId = (await owner.query('select id from accounts limit 1')).rows[0].id;
  const scarce = (await owner.query(`insert into products
    (account_id, sku, name, product_type, tracking, quantity, allow_shortage, base_price_cents)
    values ($1,'E2E-ONE','Single Unit','rental','bulk',1,false,5000) returning id`, [accountId])).rows[0].id;
  await owner.end();

  const startsAt = new Date(Date.now() + 200 * 864e5).toISOString();
  const stopsAt = new Date(Date.now() + 201 * 864e5).toISOString();
  const mk = async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${api.token()}` },
      body: JSON.stringify({ customerId: Data.customers()[0].id, startsAt, stopsAt })
    });
    const o = await res.json();
    await fetch(`${baseUrl}/api/orders/${o.id}/lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${api.token()}` },
      body: JSON.stringify({ productId: scarce, qty: 1 })
    });
    return o.id;
  };
  const a = await mk(), b = await mk();
  await api.reserve(a);
  await assert.rejects(() => api.reserve(b), /short/i,
    'the second reservation should have been refused loudly');
});

check('the settings registry the UI renders came from the same account', () => {
  assert.ok(Registry.panels().length >= 18);
  assert.ok(Data.customFields().length > 0);
  assert.ok(Data.emailTemplates().length > 0);
});

const failures = await run();
await new Promise(r => server.close(r));
await closePool();
process.exit(failures ? 1 : 0);
