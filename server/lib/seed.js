/* Load the demo account into Postgres from the same seed the front
   ends use, so the database and the browser demo never diverge. */

import { buildSeed } from '../../src/data/seed.js';
import { cents, ownerConfig } from './db.js';
import { hashPassword } from './auth.js';
import pg from 'pg';

export async function seedDatabase({ log = () => {} } = {}) {
  const seed = buildSeed();
  const c = new pg.Client(ownerConfig);
  await c.connect();
  const id = {};                                   // seed id -> uuid
  const q = (sql, params) => c.query(sql, params);
  const one = async (sql, params) => (await q(sql, params)).rows[0];

  try {
    await q('begin');

    const co = seed.company;
    const account = await one(`insert into accounts
      (name, legal_name, email, phone, website, address, city, zip, country, vat_number,
       registration, currency, currency_symbol, timezone, date_format, time_format, week_start,
       labels, order_defaults, plan, order_sequence)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      returning id`,
      [co.name, co.legal, co.email, co.phone, co.site, co.address, co.city, co.zip, co.country,
       co.vat, co.registration, co.currency, co.symbol, co.timezone, co.dateFormat, co.timeFormat,
       co.weekStart, seed.labels, seed.orderDefaults, co.plan, seed.orderSequence]);
    const A = account.id;
    log(`  account ${co.name}`);

    for (const u of seed.users) {
      const row = await one(`insert into users (account_id, name, email, password_hash, role, twofa_enabled)
        values ($1,$2,$3,$4,$5,$6) returning id`,
        [A, u.name, u.email, await hashPassword('northlight-dev'), u.role, !!u.twofa]);
      id[u.id] = row.id;
    }
    for (const l of seed.locations) {
      const row = await one(`insert into locations (account_id, name, code, kind, address, is_main)
        values ($1,$2,$3,$4,$5,$6) returning id`, [A, l.name, l.code, l.type, l.address, !!l.main]);
      id[l.id] = row.id;
    }
    for (const t of seed.taxRates) {
      const row = await one(`insert into tax_rates (account_id, name, kind, rate)
        values ($1,$2,$3,$4) returning id`, [A, t.name, t.kind, t.rate]);
      id[t.id] = row.id;
    }
    for (const p of seed.taxProfiles) {
      const row = await one(`insert into tax_profiles (account_id, name, is_default)
        values ($1,$2,$3) returning id`, [A, p.name, !!p.default]);
      id[p.id] = row.id;
      for (const r of p.rates) {
        await q(`insert into tax_profile_rates (tax_profile_id, tax_rate_id) values ($1,$2)`, [row.id, id[r]]);
      }
    }
    for (const col of seed.collections) {
      const row = await one(`insert into collections (account_id, name, show_online)
        values ($1,$2,$3) returning id`, [A, col.name, !!col.online]);
      id[col.id] = row.id;
    }
    for (const s of seed.pricingStructures) {
      const tiers = s.rows.map(r => ({ label: r.label, days: r.days, multiplier: r.mult }));
      const row = await one(`insert into pricing_structures (account_id, name, tiers)
        values ($1,$2,$3) returning id`, [A, s.name, JSON.stringify(tiers)]);
      id[s.id] = row.id;
    }
    for (const cp of seed.coupons) {
      const row = await one(`insert into coupons (account_id, code, kind, value, uses, use_limit, active, note)
        values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [A, cp.code, cp.kind, cp.value, cp.uses, cp.limit, cp.active, cp.note]);
      id[cp.id] = row.id;
    }
    for (const cu of seed.customers) {
      const row = await one(`insert into customers
        (account_id, number, kind, name, contact_name, email, phone, address, city, zip, country,
         tags, discount_pct, tax_profile_id, properties)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
        [A, cu.number, cu.kind, cu.name, cu.contact, cu.email, cu.phone, cu.address, cu.city,
         cu.zip, cu.country, cu.tags, cu.discount, id[cu.taxProfile], cu.fields]);
      id[cu.id] = row.id;
    }
    log(`  ${seed.customers.length} customers`);

    for (const p of seed.products) {
      const row = await one(`insert into products
        (account_id, sku, name, description, icon, product_type, tracking, collection_id, location_id,
         base_price_cents, price_period, price_type, structure_id, deposit_cents, quantity,
         buffer_days, allow_shortage, shortage_limit, tax_profile_id, tags, show_online)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning id`,
        [A, p.sku, p.name, p.desc, p.icon, p.type, p.track, id[p.collection] || null, id[p.location] || null,
         cents(p.price), p.period, p.priceType, id[p.structure] || null, cents(p.deposit), p.stock,
         p.buffer, p.allowShortage, p.shortageLimit, id[p.taxProfile] || null, p.tags, p.online]);
      id[p.id] = row.id;
    }
    for (const p of seed.products.filter(x => x.bundle)) {
      for (const b of p.bundle) {
        await q(`insert into bundle_items (bundle_id, product_id, quantity) values ($1,$2,1)
                 on conflict do nothing`, [id[p.id], id[b]]);
      }
    }
    for (const si of seed.stockItems) {
      const row = await one(`insert into stock_items
        (account_id, product_id, identifier, barcode, condition, location_id, note)
        values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [A, id[si.productId], si.identifier, si.barcode, si.condition, id[si.location] || null, si.note]);
      id[si.id] = row.id;
    }
    log(`  ${seed.products.length} products, ${seed.stockItems.length} stock items`);

    for (const d of seed.downtime) {
      await q(`insert into downtime (account_id, product_id, quantity, starts_at, stops_at, reason)
        values ($1,$2,$3,$4,$5,$6)`, [A, id[d.productId], d.qty, d.from, d.to, d.reason]);
    }

    for (const o of seed.orders) {
      const row = await one(`insert into orders
        (account_id, number, status, customer_id, location_id, starts_at, stops_at, source,
         deposit_cents, coupon_id, tags, properties, signature_name, signed_at, created_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
        [A, o.number, o.status, id[o.customerId], id[o.locationId], o.startsAt, o.stopsAt, o.source,
         cents(o.deposit), id[o.couponId] || null, o.tags, o.fields, o.signature, o.signedAt, o.createdAt]);
      id[o.id] = row.id;
      let pos = 0;
      for (const l of o.lines) {
        await q(`insert into order_lines
          (account_id, order_id, product_id, title, sku, quantity, price_each_cents,
           tax_profile_id, picked_qty, returned_qty, note, position)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [A, row.id, id[l.productId] || null, l.title, l.sku, l.qty, cents(l.priceEach),
           id[l.taxProfile] || null, l.pickedQty, l.returnedQty, l.note || null, pos++]);
      }
    }
    log(`  ${seed.orders.length} orders`);

    for (const p of seed.payments) {
      await q(`insert into payments (account_id, order_id, amount_cents, method, kind, status, paid_at)
        values ($1,$2,$3,$4,$5,$6,$7)`,
        [A, id[p.orderId], cents(p.amount), p.method, p.kind, p.status, p.when]);
    }
    for (const d of seed.documents) {
      await q(`insert into documents (account_id, order_id, doc_type, number, status, issued_at, sent_to, signed_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [A, id[d.orderId], d.type, d.number, d.status, d.date, d.sentTo, d.signedBy]);
    }
    for (const n of seed.notes) {
      await q(`insert into notes (account_id, target, target_id, body, author, created_at)
        values ($1,$2,$3,$4,$5,$6)`,
        [A, n.target, id[n.targetId] || n.targetId, n.body, n.by, n.when]);
    }
    for (const a of seed.activity) {
      await q(`insert into activity (account_id, order_id, what, author, highlight, created_at)
        values ($1,$2,$3,$4,$5,$6)`, [A, id[a.orderId] || null, a.what, a.by, a.hi, a.when]);
    }
    for (const f of seed.customFields) {
      await q(`insert into custom_fields (account_id, entity, label, field_type, required, on_documents)
        values ($1,$2,$3,$4,$5,$6)`, [A, f.entity, f.label, f.type, f.required, f.onDocs]);
    }
    for (const e of seed.emailTemplates) {
      await q(`insert into email_templates (account_id, name, kind, trigger_on, subject, enabled)
        values ($1,$2,$3,$4,$5,$6)`, [A, e.name, e.type, e.trigger, e.subject, e.on]);
    }
    for (const [type, prefix, seq, terms, css] of [
      ['quote', 'Q-', 2046, 'Quote valid for 14 days. Equipment is held only once reserved.', true],
      ['contract', 'C-', 1192, 'Renter assumes full liability for loss or damage.', true],
      ['invoice', 'INV-', 9048, 'Net 14. Late payments accrue 1.5% monthly.', false],
      ['packing', 'PS-', 774, 'Check every case against this list before the truck leaves.', false]
    ]) {
      await q(`insert into document_templates (account_id, doc_type, prefix, next_seq, terms, custom_css)
        values ($1,$2,$3,$4,$5,$6)`, [A, type, prefix, seq, terms, css]);
    }

    await q('commit');
    log(`  seeded account ${A}`);
    return { accountId: A, ids: id, ownerEmail: seed.users.find(u => u.me).email };
  } catch (err) {
    await q('rollback').catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
}
