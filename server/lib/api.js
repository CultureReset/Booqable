/* The HTTP API.

   Routes are declared as data: method, path pattern, the capability
   they need, and a handler that receives a client already scoped to
   the caller's account. Anything that mutates stock or money goes
   through the SQL functions in 002_logic.sql rather than reimplementing
   the rules here. */

import { withAccount, camel, camelAll, cents, dollars } from './db.js';
import { signIn, signOut, resolveSession, can } from './auth.js';

class HttpError extends Error {
  constructor(status, message, detail) { super(message); this.status = status; this.detail = detail; }
}
const bad = (m, d) => { throw new HttpError(400, m, d); };
const notFound = m => { throw new HttpError(404, m || 'Not found'); };

/* ---------- shaping: database rows -> the shape the front ends use ---------- */
const outProduct = r => ({
  id: r.id, sku: r.sku, name: r.name, desc: r.description, icon: r.icon,
  type: r.product_type, track: r.tracking, collection: r.collection_id, location: r.location_id,
  price: dollars(r.base_price_cents), period: r.price_period, priceType: r.price_type,
  structure: r.structure_id, deposit: dollars(r.deposit_cents), stock: r.quantity,
  buffer: r.buffer_days, allowShortage: r.allow_shortage, shortageLimit: r.shortage_limit,
  taxProfile: r.tax_profile_id, tags: r.tags, online: r.show_online, variations: []
});
const outCustomer = r => ({
  id: r.id, number: r.number, kind: r.kind, name: r.name, contact: r.contact_name,
  email: r.email, phone: r.phone, address: r.address, city: r.city, zip: r.zip,
  country: r.country, tags: r.tags, discount: Number(r.discount_pct),
  taxProfile: r.tax_profile_id, since: r.created_at, fields: r.properties
});
const outLine = r => ({
  id: r.id, kind: r.product_id ? 'product' : 'custom', productId: r.product_id,
  title: r.title, sku: r.sku, qty: r.quantity, priceEach: dollars(r.price_each_cents),
  taxProfile: r.tax_profile_id, pickedQty: r.picked_qty, returnedQty: r.returned_qty,
  note: r.note, stockItemIds: r.stock_item_ids || []
});
const outOrder = (r, lines = []) => ({
  id: r.id, number: r.number, status: r.status, customerId: r.customer_id,
  locationId: r.location_id, startsAt: r.starts_at, stopsAt: r.stops_at, source: r.source,
  deposit: dollars(r.deposit_cents), couponId: r.coupon_id, tags: r.tags, fields: r.properties,
  signature: r.signature_name, signedAt: r.signed_at, createdAt: r.created_at, lines
});
const outTotals = t => ({
  subtotal: dollars(t.subtotal_cents), customerDiscount: dollars(t.customer_discount_cents),
  couponDiscount: dollars(t.coupon_cents), taxRate: Number(t.tax_rate), tax: dollars(t.tax_cents),
  total: dollars(t.total_cents), paid: dollars(t.paid_cents), due: dollars(t.due_cents),
  deposit: dollars(t.deposit_cents), heldDeposit: dollars(t.held_deposit_cents)
});

async function loadOrder(c, id) {
  const { rows } = await c.query('select * from orders where id = $1', [id]);
  if (!rows[0]) notFound('Order not found');
  const lines = await c.query(
    `select l.*, coalesce(array_agg(lsi.stock_item_id) filter (where lsi.stock_item_id is not null), '{}') as stock_item_ids
     from order_lines l left join line_stock_items lsi on lsi.line_id = l.id
     where l.order_id = $1 group by l.id order by l.position`, [id]);
  const totals = await c.query('select * from order_totals($1)', [id]);
  const shortages = await c.query('select * from order_shortages($1)', [id]);
  return {
    ...outOrder(rows[0], lines.rows.map(outLine)),
    totals: outTotals(totals.rows[0]),
    shortages: camelAll(shortages.rows)
  };
}

async function log(c, accountId, orderId, what, author, highlight = false) {
  await c.query(`insert into activity (account_id, order_id, what, author, highlight)
                 values ($1,$2,$3,$4,$5)`, [accountId, orderId, what, author, highlight]);
}

/* ---------- routes ---------- */
export const ROUTES = [
  /* --- auth --- */
  { method: 'POST', path: '/api/auth/signin', public: true, handler: async ({ body, headers }) => {
    const out = await signIn({ email: body.email, password: body.password, userAgent: headers['user-agent'] });
    if (!out.ok) throw new HttpError(401, out.error);
    return out;
  } },
  { method: 'POST', path: '/api/auth/signout', handler: async ({ token }) => { await signOut(token); return { ok: true }; } },
  { method: 'GET', path: '/api/auth/me', handler: async ({ session }) => ({ user: session.user, accountId: session.accountId }) },

  /* --- everything the client needs to start --- */
  { method: 'GET', path: '/api/bootstrap', cap: 'orders:read', handler: async ({ c }) => {
    const t = async (sql, params = []) => (await c.query(sql, params)).rows;
    const account = (await t('select * from accounts limit 1'))[0];
    const orders = await t('select * from orders order by starts_at desc');
    const lines = await t(`select l.*, coalesce(array_agg(lsi.stock_item_id)
        filter (where lsi.stock_item_id is not null), '{}') as stock_item_ids
      from order_lines l left join line_stock_items lsi on lsi.line_id = l.id
      group by l.id order by l.position`);
    const byOrder = {};
    lines.forEach(l => (byOrder[l.order_id] ||= []).push(outLine(l)));
    return {
      company: {
        name: account.name, legal: account.legal_name, email: account.email, phone: account.phone,
        site: account.website, address: account.address, city: account.city, zip: account.zip,
        country: account.country, vat: account.vat_number, registration: account.registration,
        currency: account.currency, symbol: account.currency_symbol, timezone: account.timezone,
        dateFormat: account.date_format, timeFormat: account.time_format,
        weekStart: account.week_start, plan: account.plan
      },
      labels: account.labels,
      orderDefaults: account.order_defaults,
      orderSequence: account.order_sequence,
      locations: (await t('select * from locations order by is_main desc, name'))
        .map(r => ({ id: r.id, name: r.name, code: r.code, type: r.kind, address: r.address, main: r.is_main })),
      taxRates: (await t('select * from tax_rates order by name'))
        .map(r => ({ id: r.id, name: r.name, kind: r.kind, rate: Number(r.rate) })),
      taxProfiles: await Promise.all((await t('select * from tax_profiles order by name')).map(async p => ({
        id: p.id, name: p.name, default: p.is_default,
        rates: (await t('select tax_rate_id from tax_profile_rates where tax_profile_id = $1', [p.id]))
          .map(x => x.tax_rate_id)
      }))),
      collections: (await t('select * from collections order by name'))
        .map(r => ({ id: r.id, name: r.name, online: r.show_online })),
      pricingStructures: (await t('select * from pricing_structures order by name'))
        .map(r => ({ id: r.id, name: r.name, rows: r.tiers.map(x => ({ label: x.label, mult: x.multiplier })) })),
      coupons: (await t('select * from coupons order by code'))
        .map(r => ({ id: r.id, code: r.code, kind: r.kind, value: Number(r.value), uses: r.uses, limit: r.use_limit, active: r.active, note: r.note })),
      users: (await t('select * from users order by created_at'))
        .map((r, i) => ({ id: r.id, name: r.name, email: r.email, role: r.role, twofa: r.twofa_enabled, last: r.last_seen_at, me: i === 0 })),
      customers: (await t('select * from customers order by name')).map(outCustomer),
      products: (await t('select * from products order by name')).map(outProduct),
      stockItems: (await t('select * from stock_items order by identifier'))
        .map(r => ({ id: r.id, productId: r.product_id, identifier: r.identifier, barcode: r.barcode, condition: r.condition, location: r.location_id, note: r.note })),
      downtime: (await t('select * from downtime'))
        .map(r => ({ id: r.id, productId: r.product_id, qty: r.quantity, from: r.starts_at, to: r.stops_at, reason: r.reason })),
      orders: orders.map(o => outOrder(o, byOrder[o.id] || [])),
      payments: (await t('select * from payments order by paid_at'))
        .map(r => ({ id: r.id, orderId: r.order_id, amount: dollars(r.amount_cents), method: r.method, kind: r.kind, status: r.status, when: r.paid_at })),
      documents: (await t('select * from documents order by issued_at desc'))
        .map(r => ({ id: r.id, orderId: r.order_id, type: r.doc_type, number: r.number, status: r.status, date: r.issued_at, sentTo: r.sent_to, signedBy: r.signed_by })),
      notes: (await t('select * from notes order by created_at'))
        .map(r => ({ id: r.id, target: r.target, targetId: r.target_id, body: r.body, by: r.author, when: r.created_at })),
      activity: (await t('select * from activity order by created_at desc limit 200'))
        .map(r => ({ id: r.id, orderId: r.order_id, what: r.what, by: r.author, hi: r.highlight, when: r.created_at })),
      customFields: (await t('select * from custom_fields'))
        .map(r => ({ id: r.id, entity: r.entity, label: r.label, type: r.field_type, required: r.required, onDocs: r.on_documents })),
      emailTemplates: (await t('select * from email_templates'))
        .map(r => ({ id: r.id, name: r.name, type: r.kind, trigger: r.trigger_on, subject: r.subject, on: r.enabled }))
    };
  } },

  /* --- availability: the question the whole product exists to answer --- */
  { method: 'GET', path: '/api/availability', cap: 'orders:read', handler: async ({ c, query }) => {
    if (!query.product || !query.from || !query.to) bad('product, from and to are required');
    const { rows } = await c.query('select available_qty($1,$2,$3,$4) as available',
      [query.product, query.from, query.to, query.ignoreOrder || null]);
    return { product: query.product, from: query.from, to: query.to, available: rows[0].available };
  } },

  /* --- orders --- */
  { method: 'GET', path: '/api/orders', cap: 'orders:read', handler: async ({ c, query }) => {
    const where = [];
    const params = [];
    if (query.status) { params.push(query.status.split(',')); where.push(`status = any($${params.length}::order_status[])`); }
    const { rows } = await c.query(
      `select * from orders ${where.length ? 'where ' + where.join(' and ') : ''} order by starts_at desc`, params);
    return { orders: await Promise.all(rows.map(r => loadOrder(c, r.id))) };
  } },
  { method: 'GET', path: '/api/orders/:id', cap: 'orders:read', handler: ({ c, params }) => loadOrder(c, params.id) },

  { method: 'POST', path: '/api/orders', cap: 'orders:write', handler: async ({ c, body, session }) => {
    if (!body.customerId) bad('customerId is required');
    if (!body.startsAt || !body.stopsAt) bad('startsAt and stopsAt are required');
    if (new Date(body.stopsAt) <= new Date(body.startsAt)) bad('stopsAt must be after startsAt');
    const seq = await c.query(
      'update accounts set order_sequence = order_sequence + 1 returning order_sequence, id');
    const acc = seq.rows[0];
    const { rows } = await c.query(`insert into orders
      (account_id, number, status, customer_id, location_id, starts_at, stops_at, source, deposit_cents)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [acc.id, acc.order_sequence, body.status === 'reserved' ? 'concept' : 'concept',
       body.customerId, body.locationId || null, body.startsAt, body.stopsAt,
       body.source || 'API', cents(body.deposit || 0)]);
    await log(c, acc.id, rows[0].id, `Order created via ${body.source || 'the API'}`, session.user.name);
    if (body.status === 'reserved') {
      const r = await c.query('select * from reserve_order($1)', [rows[0].id]);
      if (!r.rows[0].ok) throw new HttpError(409, r.rows[0].message);
    }
    return loadOrder(c, rows[0].id);
  } },

  { method: 'PATCH', path: '/api/orders/:id', cap: 'orders:write', handler: async ({ c, params, body }) => {
    const sets = [], vals = [];
    const map = { startsAt: 'starts_at', stopsAt: 'stops_at', locationId: 'location_id',
      couponId: 'coupon_id', tags: 'tags', fields: 'properties' };
    for (const [k, col] of Object.entries(map)) {
      if (body[k] !== undefined) { vals.push(body[k]); sets.push(`${col} = $${vals.length}`); }
    }
    if (body.deposit !== undefined) { vals.push(cents(body.deposit)); sets.push(`deposit_cents = $${vals.length}`); }
    if (!sets.length) return loadOrder(c, params.id);
    vals.push(params.id);
    const { rowCount } = await c.query(`update orders set ${sets.join(', ')} where id = $${vals.length}`, vals);
    if (!rowCount) notFound('Order not found');
    return loadOrder(c, params.id);
  } },

  { method: 'POST', path: '/api/orders/:id/lines', cap: 'orders:write', handler: async ({ c, params, body, session }) => {
    const order = (await c.query('select * from orders where id = $1', [params.id])).rows[0];
    if (!order) notFound('Order not found');
    let title = body.title, sku = body.sku || '—', price = body.priceEach, taxProfile = body.taxProfile || null;
    if (body.productId) {
      const p = (await c.query('select * from products where id = $1', [body.productId])).rows[0];
      if (!p) notFound('Product not found');
      title = title || p.name; sku = p.sku;
      price = price === undefined ? dollars(p.base_price_cents) : price;
      taxProfile = taxProfile || p.tax_profile_id;
      if (p.deposit_cents && !order.deposit_cents) {
        await c.query('update orders set deposit_cents = $1 where id = $2', [p.deposit_cents, order.id]);
      }
    }
    if (!title) bad('title or productId is required');
    const pos = (await c.query('select coalesce(max(position),-1)+1 as n from order_lines where order_id=$1', [params.id])).rows[0].n;
    const { rows } = await c.query(`insert into order_lines
      (account_id, order_id, product_id, title, sku, quantity, price_each_cents, tax_profile_id, note, position)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [order.account_id, order.id, body.productId || null, title, sku, body.qty || 1,
       cents(price || 0), taxProfile, body.note || null, pos]);
    await log(c, order.account_id, order.id, `${title} added to the order`, session.user.name);
    return { line: outLine(rows[0]), order: await loadOrder(c, order.id) };
  } },

  { method: 'DELETE', path: '/api/orders/:id/lines/:lineId', cap: 'orders:write', handler: async ({ c, params }) => {
    const { rowCount } = await c.query('delete from order_lines where id = $1 and order_id = $2',
      [params.lineId, params.id]);
    if (!rowCount) notFound('Line not found');
    return loadOrder(c, params.id);
  } },

  /* --- lifecycle --- */
  { method: 'POST', path: '/api/orders/:id/reserve', cap: 'orders:write', handler: async ({ c, params }) => {
    const { rows } = await c.query('select * from reserve_order($1)', [params.id]);
    if (!rows[0].ok) throw new HttpError(409, rows[0].message);
    return loadOrder(c, params.id);
  } },

  { method: 'POST', path: '/api/orders/:id/pickup', cap: 'fulfil', handler: async ({ c, params, body, session }) => {
    const order = (await c.query('select * from orders where id = $1', [params.id])).rows[0];
    if (!order) notFound('Order not found');
    if (!['reserved', 'started', 'mixed'].includes(order.status)) {
      throw new HttpError(409, `Cannot pick up an order that is ${order.status}`);
    }
    const moves = body.lines || [];
    if (!moves.length) bad('lines is required');
    const { rows } = await c.query('select * from fulfil_lines($1,$2,$3)',
      [params.id, JSON.stringify(moves), 'pickup']);
    for (const m of moves) {
      for (const si of m.stockItemIds || []) {
        await c.query(`insert into line_stock_items (line_id, stock_item_id) values ($1,$2)
                       on conflict do nothing`, [m.line, si]);
      }
    }
    if (body.signature) {
      await c.query('update orders set signature_name = $1, signed_at = now() where id = $2',
        [body.signature, params.id]);
      await c.query(`update documents set signed_by = $1, status = 'Signed'
                     where order_id = $2 and doc_type = 'contract'`, [body.signature, params.id]);
    }
    await log(c, order.account_id, params.id,
      `${rows[0].moved} item(s) picked up — status ${rows[0].status}`, session.user.name, true);
    return loadOrder(c, params.id);
  } },

  { method: 'POST', path: '/api/orders/:id/return', cap: 'fulfil', handler: async ({ c, params, body, session }) => {
    const order = (await c.query('select * from orders where id = $1', [params.id])).rows[0];
    if (!order) notFound('Order not found');
    if (!['started', 'mixed'].includes(order.status)) {
      throw new HttpError(409, `Cannot return an order that is ${order.status}`);
    }
    const { rows } = await c.query('select * from fulfil_lines($1,$2,$3)',
      [params.id, JSON.stringify(body.lines || []), 'return']);

    const withheld = cents(body.withhold || 0);
    const hold = (await c.query(
      `select * from payments where order_id = $1 and kind = 'Security deposit hold'
       and status = 'Authorized' limit 1`, [params.id])).rows[0];
    if (hold) {
      if (withheld > 0) {
        if (withheld > hold.amount_cents) bad('Cannot withhold more than the deposit held');
        await c.query(`update payments set status='Paid', amount_cents=$1,
                       kind='Deposit captured (damage)' where id=$2`, [withheld, hold.id]);
        await log(c, order.account_id, params.id, `${dollars(withheld)} withheld from the deposit`, session.user.name);
      } else {
        await c.query(`update payments set status='Released' where id=$1`, [hold.id]);
        await log(c, order.account_id, params.id, 'Security deposit released', session.user.name);
      }
    }
    if (body.note) {
      await c.query(`insert into notes (account_id, target, target_id, body, author)
                     values ($1,'order',$2,$3,$4)`,
        [order.account_id, params.id, 'Return note: ' + body.note, session.user.name]);
    }
    await log(c, order.account_id, params.id,
      `${rows[0].moved} item(s) returned — status ${rows[0].status}`, session.user.name, true);
    return loadOrder(c, params.id);
  } },

  { method: 'POST', path: '/api/orders/:id/status', cap: 'orders:write', handler: async ({ c, params, body, session }) => {
    const allowed = { archive: ['stopped'], cancel: ['concept', 'reserved'], reopen: ['archived'] };
    const to = { archive: 'archived', cancel: 'canceled', reopen: 'stopped' }[body.action];
    if (!to) bad('action must be archive, cancel or reopen');
    const order = (await c.query('select * from orders where id = $1 for update', [params.id])).rows[0];
    if (!order) notFound('Order not found');
    if (!allowed[body.action].includes(order.status)) {
      throw new HttpError(409, `Cannot ${body.action} an order that is ${order.status}`);
    }
    await c.query('update orders set status = $1 where id = $2', [to, params.id]);
    await log(c, order.account_id, params.id, `Order ${body.action}d`, session.user.name, true);
    return loadOrder(c, params.id);
  } },

  /* --- money --- */
  { method: 'POST', path: '/api/orders/:id/payments', cap: 'money:write', handler: async ({ c, params, body, session }) => {
    const order = (await c.query('select * from orders where id = $1', [params.id])).rows[0];
    if (!order) notFound('Order not found');
    const amount = cents(body.amount);
    if (!amount || amount <= 0) bad('amount must be greater than zero');
    const kind = body.kind || 'Full payment';
    const { rows } = await c.query(`insert into payments
      (account_id, order_id, amount_cents, method, kind, status)
      values ($1,$2,$3,$4,$5,$6) returning *`,
      [order.account_id, params.id, amount, body.method || 'Credit card', kind,
       kind === 'Security deposit hold' ? 'Authorized' : 'Paid']);
    await log(c, order.account_id, params.id,
      `${kind} of ${dollars(amount)} registered (${body.method || 'Credit card'})`, session.user.name);
    const totals = (await c.query('select * from order_totals($1)', [params.id])).rows[0];
    await c.query(`update documents set status = $1 where order_id = $2 and doc_type = 'invoice'`,
      [totals.due_cents <= 0 ? 'Paid' : totals.paid_cents > 0 ? 'Partially paid' : 'Sent', params.id]);
    return { payment: camel(rows[0]), order: await loadOrder(c, params.id) };
  } },

  /* --- documents --- */
  { method: 'POST', path: '/api/orders/:id/documents', cap: 'orders:write', handler: async ({ c, params, body, session }) => {
    const order = (await c.query('select * from orders where id = $1', [params.id])).rows[0];
    if (!order) notFound('Order not found');
    const type = body.type;
    if (!['quote', 'contract', 'invoice', 'packing'].includes(type)) bad('unknown document type');
    const tpl = (await c.query(
      `update document_templates set next_seq = next_seq + 1
       where doc_type = $1 returning prefix, next_seq`, [type])).rows[0];
    if (!tpl) bad('no template configured for that type');
    const number = tpl.prefix + tpl.next_seq;
    const { rows } = await c.query(`insert into documents
      (account_id, order_id, doc_type, number, status) values ($1,$2,$3,$4,$5) returning *`,
      [order.account_id, params.id, type, number, type === 'invoice' ? 'Sent' : type === 'packing' ? 'Printed' : 'Draft']);
    await log(c, order.account_id, params.id, `${number} generated`, session.user.name);
    return camel(rows[0]);
  } },

  /* --- catalogue --- */
  { method: 'GET', path: '/api/products', cap: 'orders:read', handler: async ({ c }) =>
    ({ products: (await c.query('select * from products order by name')).rows.map(outProduct) }) },
  { method: 'POST', path: '/api/products', cap: 'catalog:write', handler: async ({ c, body }) => {
    if (!body.name || !body.sku) bad('name and sku are required');
    const acc = (await c.query('select id from accounts limit 1')).rows[0];
    const { rows } = await c.query(`insert into products
      (account_id, sku, name, description, product_type, tracking, base_price_cents, quantity)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [acc.id, body.sku, body.name, body.desc || null, body.type || 'rental',
       body.track || 'bulk', cents(body.price || 0), body.stock || 0]);
    return outProduct(rows[0]);
  } },
  { method: 'PATCH', path: '/api/stock-items/:id', cap: 'catalog:write', handler: async ({ c, params, body }) => {
    const { rows } = await c.query(
      `update stock_items set condition = coalesce($1, condition), note = coalesce($2, note)
       where id = $3 returning *`, [body.condition || null, body.note ?? null, params.id]);
    if (!rows[0]) notFound('Stock item not found');
    return camel(rows[0]);
  } },

  /* --- customers --- */
  { method: 'GET', path: '/api/customers', cap: 'orders:read', handler: async ({ c }) =>
    ({ customers: (await c.query('select * from customers order by name')).rows.map(outCustomer) }) },
  { method: 'POST', path: '/api/customers', cap: 'orders:write', handler: async ({ c, body }) => {
    if (!body.name) bad('name is required');
    const acc = (await c.query('select id from accounts limit 1')).rows[0];
    const n = (await c.query('select count(*)::int as n from customers')).rows[0].n;
    const { rows } = await c.query(`insert into customers
      (account_id, number, kind, name, contact_name, email, phone) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [acc.id, body.number || `CUST-${1041 + n}`, body.kind || 'Company', body.name,
       body.contact || body.name, body.email || null, body.phone || null]);
    return outCustomer(rows[0]);
  } },

  /* --- reports --- */
  { method: 'GET', path: '/api/reports/pull-sheet', cap: 'orders:read', handler: async ({ c, query }) => {
    const { rows } = await c.query(
      `select p.id, p.name, p.sku, sum(l.quantity)::int as needed,
              array_agg(distinct o.number order by o.number) as orders
       from order_lines l
       join orders o on o.id = l.order_id
       join products p on p.id = l.product_id
       where o.status = any (holding_statuses())
         and o.starts_at < $2 and o.stops_at > $1
       group by p.id, p.name, p.sku order by needed desc`,
      [query.from || new Date().toISOString(), query.to || new Date(Date.now() + 864e5).toISOString()]);
    return { rows: camelAll(rows) };
  } },
  { method: 'GET', path: '/api/reports/utilisation', cap: 'orders:read', handler: async ({ c }) => {
    const { rows } = await c.query(
      `select p.id, p.name, p.sku, p.quantity,
              coalesce(sum(l.quantity * greatest(1, ceil(extract(epoch from (o.stops_at - o.starts_at))/86400.0))), 0)::int as rental_days,
              coalesce(sum(round(l.quantity * l.price_each_cents
                * charge_units(l.product_id, o.starts_at, o.stops_at))), 0)::bigint as revenue_cents
       from products p
       left join order_lines l on l.product_id = p.id
       left join orders o on o.id = l.order_id and o.status not in ('canceled','concept')
       group by p.id order by revenue_cents desc`);
    return { rows: rows.map(r => ({ ...camel(r), revenue: dollars(Number(r.revenue_cents)) })) };
  } }
];

/* ---------- dispatch ---------- */
const compile = path => {
  const names = [];
  const rx = new RegExp('^' + path.replace(/:([A-Za-z]+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
  return { rx, names };
};
const COMPILED = ROUTES.map(r => ({ ...r, ...compile(r.path) }));

export async function handle({ method, pathname, query, body, headers }) {
  const token = (headers.authorization || '').replace(/^Bearer\s+/i, '') || null;

  for (const route of COMPILED) {
    if (route.method !== method) continue;
    const m = route.rx.exec(pathname);
    if (!m) continue;
    const params = Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));

    if (route.public) return { status: 200, body: await route.handler({ body, headers, query, params }) };

    const session = await resolveSession(token);
    if (!session) return { status: 401, body: { error: 'Sign in required' } };
    if (route.cap && !can(session.user.role, route.cap)) {
      return { status: 403, body: { error: `Your role (${session.user.role}) cannot ${route.cap}` } };
    }
    const out = await withAccount(session.accountId, c =>
      route.handler({ c, body, headers, query, params, session, token }));
    return { status: 200, body: out };
  }
  return { status: 404, body: { error: `No route for ${method} ${pathname}` } };
}

export { HttpError };
