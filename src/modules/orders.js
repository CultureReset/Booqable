import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { esc, uid, D, sum, daysBetween } from '../core/util.js';
import { icon, card, empty, pageHead, toast, chip, avatar, Modal, tabs, banner } from '../core/ui.js';
import { money, fmtD, fmtT, fmtDY, fmtDT, fmtRel } from '../core/fields.js';
import { DataTable, Form } from '../core/view.js';
import {
  Lifecycle, applyTransition, deriveStatus, isLate, isLateReturn,
  totalItems, pickedItems, returnedItems
} from '../schema/lifecycle.js';
import { orderTotals, lineTotal, lineUnits } from '../schema/pricing.js';
import { orderShortages, availableQty, withShortages } from '../schema/availability.js';
import { createDocument, documentsFor } from '../schema/documents.js';
import { noteCard } from './dashboard.js';
import { render } from '../core/app.js';
import { setValue } from '../core/fields.js';

/* List filters are data, so a new saved view is one array entry. */
const FILTERS = [
  { id: 'open', label: 'Open', match: o => Lifecycle.state(o.status).holdsStock },
  { id: 'all', label: 'All', match: () => true },
  { id: 'concept', label: 'Concepts', match: o => o.status === 'concept' },
  { id: 'reserved', label: 'Reserved', match: o => o.status === 'reserved' },
  { id: 'started', label: 'Picked up', match: o => ['started', 'mixed'].includes(o.status) },
  { id: 'stopped', label: 'Returned', match: o => o.status === 'stopped' },
  { id: 'late', label: 'Overdue', match: isLate },
  { id: 'archived', label: 'Archived', match: o => o.status === 'archived' },
  { id: 'canceled', label: 'Canceled', match: o => o.status === 'canceled' }
];
const LIST_COLUMNS = ['number', 'customerId', 'status', 'period', 'items', 'source', 'total', 'due'];

/* Detail tabs are data too — a plugin can push one. */
export const ORDER_TABS = [
  { id: 'lines', label: 'Items & pricing', order: 10, render: linesTab },
  { id: 'documents', label: 'Documents', order: 20, count: o => documentsFor(o.id).length, render: documentsTab },
  { id: 'payments', label: 'Payments', order: 30, count: o => paymentsFor(o.id).length, render: paymentsTab },
  { id: 'notes', label: 'Notes', order: 40, count: o => notesFor(o.id).length, render: notesTab },
  { id: 'activity', label: 'Activity', order: 50, count: o => activityFor(o.id).length, render: activityTab },
  { id: 'fields', label: 'Custom fields', order: 60, count: o => Object.keys(o.fields).length, render: fieldsTab }
];

const paymentsFor = id => Data.payments().filter(p => p.orderId === id);
const notesFor = id => Data.notes().filter(n => n.target === 'order' && n.targetId === id);
const activityFor = id => Data.activity().filter(a => a.orderId === id);

export function logActivity(orderId, what, hi = false) {
  Store.insert('activity', { id: uid('ac'), orderId, what, by: Data.me().name, when: new Date().toISOString(), hi });
}

function filteredOrders(S) {
  const f = FILTERS.find(x => x.id === (S.tab['orders.filter'] || 'open')) || FILTERS[0];
  const q = (S.query['orders'] || '').trim().toLowerCase();
  return Data.orders().filter(f.match).filter(o => {
    if (!q) return true;
    const c = Data.customer(o.customerId);
    return String(o.number).includes(q)
      || (c && c.name.toLowerCase().includes(q))
      || o.lines.some(l => l.title.toLowerCase().includes(q) || String(l.sku).toLowerCase().includes(q));
  }).sort((a, b) => D(b.startsAt) - D(a.startsAt));
}

Registry.module({
  id: 'orders', label: 'Orders', icon: 'orders', order: 20,
  entity: 'orders',
  badge: () => { const n = Data.orders().filter(isLate).length; return n ? { count: n, tone: 'crit' } : null; },

  render({ S }) {
    const rows = filteredOrders(S);
    const active = S.tab['orders.filter'] || 'open';
    return `
    ${pageHead({
      title: 'Orders',
      sub: `${Data.orders().length} orders total · ${Data.orders().filter(isLate).length} need attention right now`,
      actions: `<button class="btn" data-act="export.csv" data-entity="orders">Export CSV</button>
                <button class="btn primary" data-act="order.new">${icon('plus', 15, 2.2)} New order</button>`
    })}
    ${tabs(FILTERS.map(f => ({ id: f.id, label: f.label, count: Data.orders().filter(f.match).length })), active, 'orders.filter')}
    <div class="row" style="margin-bottom:12px;flex-wrap:wrap">
      <div class="search" style="max-width:320px">${icon('search', 15, 2)}
        <input type="search" placeholder="Order #, customer or product…" value="${esc(S.query['orders'] || '')}" data-search="orders"></div>
      ${S.selection.size
        ? `<span class="chip info">${S.selection.size} selected</span>
           <button class="btn sm" data-act="order.bulkArchive">Archive</button>
           <button class="btn sm" data-act="order.bulkTag">Add tag</button>
           <button class="btn sm ghost" data-act="selection.clear">Clear</button>`
        : '<span class="dim" style="font-size:12.5px">Tick rows to bulk-edit. Click a row to open it.</span>'}
    </div>
    <div class="card">${DataTable({
      entity: 'orders', columns: LIST_COLUMNS, rows, rowGo: 'orders', select: S.selection,
      empty: empty('No orders match', 'Try a different tab or clear the search.')
    })}</div>`;
  },

  detail(id, { S }) {
    const o = Data.order(id);
    if (!o) return empty('Order not found');
    withShortages(o);
    const c = Data.customer(o.customerId);
    const t = orderTotals(o);
    const active = S.tab['orders.tab'] || 'lines';
    const stepIdx = Lifecycle.flow.indexOf(o.status === 'mixed' ? 'started' : o.status);

    return `
    <div class="row" style="margin-bottom:12px">
      <button class="btn ghost sm" data-go="orders">← Orders</button>
      <span class="dim" style="font-size:12.5px">${esc(Lifecycle.state(o.status).hint)}</span>
    </div>

    <div class="order-hero">
      <div class="spread" style="align-items:flex-start;flex-wrap:wrap">
        <div>
          <div class="row">
            <span class="order-num">#${o.number}</span>
            ${chip(Lifecycle.label(o.status), Lifecycle.tone(o.status))}
            ${isLate(o) ? chip(isLateReturn(o)
              ? `Overdue by ${Math.ceil((Date.now() - D(o.stopsAt)) / 864e5)}d` : 'Pickup past due', 'crit') : ''}
            ${o.tags.map(x => `<span class="tag">${esc(x)}</span>`).join('')}
          </div>
          <div class="muted" style="margin-top:5px;font-size:13px">
            ${esc(c.name)} · ${fmtDY(o.startsAt)} ${fmtT(o.startsAt)} → ${fmtDY(o.stopsAt)} ${fmtT(o.stopsAt)}
            · <span class="num">${daysBetween(o.startsAt, o.stopsAt)}</span> day charge · ${esc(Data.location(o.locationId).name)}
          </div>
        </div>
        <div class="wrap" style="justify-content:flex-end">${actionBar(o)}</div>
      </div>
      <div class="stepper">
        ${Lifecycle.flow.map((s, i) => `<div class="step ${i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}">
          <span class="n">${i < stepIdx ? '✓' : i + 1}</span>${Lifecycle.label(s)}</div>`).join('')}
        ${o.status === 'canceled' ? `<div class="step now" style="background:var(--st-canceled);color:#fff"><span class="n">✕</span>Canceled</div>` : ''}
        ${o.status === 'mixed' ? `<span class="chip mixed" style="margin-left:6px"><span class="dot"></span>Mixed — ${pickedItems(o) - returnedItems(o)} of ${totalItems(o)} still out</span>` : ''}
      </div>
    </div>

    ${o.shortages.length ? `<div style="margin-bottom:16px">${banner(o.shortages.every(s => s.allowed) ? 'warn' : 'crit',
      `<b>Stock shortage on ${o.shortages.length} line${o.shortages.length > 1 ? 's' : ''}.</b>` +
      o.shortages.map(s => `<div style="margin-top:3px">${esc(s.product.name)} — booked ${s.line.qty}, available ${s.avail} (short ${s.gap})${
        s.allowed ? ` · within the ${s.product.shortageLimit}-unit shortage limit` : ' · over the limit, this will block'}</div>`).join(''))}</div>` : ''}

    <div class="cols detail">
      <div>
        ${tabs(ORDER_TABS.map(tb => ({ id: tb.id, label: tb.label, count: tb.count ? tb.count(o) : undefined })), active, 'orders.tab')}
        ${(ORDER_TABS.find(x => x.id === active) || ORDER_TABS[0]).render(o, t)}
      </div>
      ${sidebar(o, c, t)}
    </div>`;
  },

  actions: {
    /* One handler covers every lifecycle transition, driven by config. */
    'order.transition': ({ data, render, go, setTab }) => {
      const o = Data.order(data.order);
      const tr = Lifecycle.transitions.find(x => x.id === data.transition);
      if (!o || !tr) return;

      if (tr.tab) return setTab('orders.tab', tr.tab);
      if (tr.id === 'duplicate') return duplicateOrder(o, go);
      if (tr.modal) return tr.modal === 'pickup' ? openPickup(o) : openReturn(o);
      if (tr.confirm && !confirm(tr.confirm(o))) return;

      withShortages(o);
      const blocked = tr.guard ? tr.guard(o) : null;
      if (blocked) return toast('Blocked: ' + blocked, 'bad');

      applyTransition(o, tr, { onLog: msg => logActivity(o.id, msg, true) });
      toast(`Order #${o.number} — ${Lifecycle.label(o.status).toLowerCase()}`);
      render();
    },

    'order.new': ({ data, render }) => openNewOrder(data.customer, data.product, render),
    'order.create': ({ el, render, go }) => createOrder(el.dataset.mode, el.dataset.product, go),
    'order.addProduct': ({ data }) => openProductPicker(Data.order(data.order)),
    'order.pickProduct': ({ data, render }) => {
      const o = Data.order(data.order);
      const p = Data.product(data.product);
      const existing = o.lines.find(l => l.productId === p.id);
      if (existing) existing.qty++;
      else o.lines.push(newLine(p));
      if (p.deposit && !o.deposit) o.deposit = p.deposit;
      Store.changed('orders');
      const list = document.querySelector('#picker-list');
      if (list) list.innerHTML = productPickerList(o, document.querySelector('#picker-q')?.value || '');
      toast(`${p.name} added`);
      render();
    },
    'order.addCustom': ({ data, render }) => {
      const o = Data.order(data.order);
      const title = prompt('What is the line called?', 'Cleaning fee');
      if (!title) return;
      const price = +prompt('Price for this line', '50') || 0;
      o.lines.push({ id: uid('ln'), kind: 'custom', productId: null, title, sku: '—', qty: 1,
        priceEach: price, taxProfile: 'tp_std', pickedQty: 0, returnedQty: 0, stockItemIds: [] });
      Store.changed('orders');
      logActivity(o.id, `Custom line "${title}" added`);
      toast('Custom line added'); render();
    },
    'order.removeLine': ({ data, render }) => {
      const o = Data.order(data.order);
      o.lines = o.lines.filter(l => l.id !== data.line);
      Store.changed('orders'); toast('Line removed'); render();
    },
    'order.coupon': ({ data, render }) => {
      const o = Data.order(data.order);
      const code = prompt('Coupon code — try WEEKEND15 or FILMSCHOOL', 'WEEKEND15');
      if (!code) return;
      const cp = Data.coupons().find(x => x.code.toLowerCase() === code.trim().toLowerCase() && x.active);
      if (!cp) return toast('No active coupon with that code', 'bad');
      o.couponId = cp.id; cp.uses++;
      Store.changed('orders'); logActivity(o.id, `Coupon ${cp.code} applied`);
      toast(`${cp.code} applied`); render();
    },
    'order.removeCoupon': ({ data, render }) => {
      const o = Data.order(data.order); o.couponId = null;
      Store.changed('orders'); toast('Coupon removed'); render();
    },
    'order.deposit': ({ data, render }) => {
      const o = Data.order(data.order);
      const v = prompt('Security deposit amount', o.deposit || 0);
      if (v === null) return;
      o.deposit = +v || 0; Store.changed('orders'); toast('Deposit updated'); render();
    },
    'order.confirmPickup': ({ data, render }) => confirmPickup(Data.order(data.order), render),
    'order.confirmReturn': ({ data, render }) => confirmReturn(Data.order(data.order), render),
    'order.clearSignature': () => {
      const c = document.querySelector('#sigpad');
      if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); delete c.dataset.signed; }
    },
    'order.sign': ({ data, render }) => {
      const o = Data.order(data.order);
      o.signature = Data.customer(o.customerId).contact;
      o.signedAt = new Date().toISOString();
      Store.changed('orders'); logActivity(o.id, `Signature collected from ${o.signature}`);
      toast('Signature captured'); render();
    },
    'order.bulkArchive': ({ S, render }) => {
      let n = 0;
      S.selection.forEach(id => {
        const o = Data.order(id);
        if (o && ['stopped', 'canceled'].includes(o.status)) { o.status = 'archived'; logActivity(id, 'Archived in bulk'); n++; }
      });
      Store.changed('orders');
      toast(`${n} archived — only returned or canceled orders can be`);
      S.selection.clear(); render();
    },
    'order.bulkTag': ({ S, render }) => {
      const t = prompt('Tag to add', 'priority');
      if (!t) return;
      S.selection.forEach(id => { const o = Data.order(id); if (o && !o.tags.includes(t)) o.tags.push(t); });
      Store.changed('orders'); toast(`Tagged ${S.selection.size} order(s)`); S.selection.clear(); render();
    },
    'selection.clear': ({ S, render }) => { S.selection.clear(); render(); },

    /* payments */
    'payment.new': ({ data }) => openPayment(Data.order(data.order)),
    'payment.confirm': ({ data, render }) => confirmPayment(Data.order(data.order), render),
    'payment.request': ({ data, render }) => {
      const o = Data.order(data.order);
      logActivity(o.id, 'Payment link emailed to the customer');
      toast(`Payment link sent to ${Data.customer(o.customerId).email}`); render();
    },
    'payment.holdDeposit': ({ data, render }) => {
      const o = Data.order(data.order);
      Store.insert('payments', { id: uid('pay'), orderId: o.id, amount: o.deposit, method: 'Credit card',
        kind: 'Security deposit hold', when: new Date().toISOString(), status: 'Authorized' });
      logActivity(o.id, `Security deposit of ${money(o.deposit)} authorised`);
      toast('Deposit held'); render();
    },
    'payment.capture': ({ data, render }) => {
      const p = Data.payments().find(x => x.id === data.payment);
      const keep = +prompt(`Capture how much of the ${money(p.amount)} hold? 0 releases it in full.`, '0') || 0;
      if (keep > 0) { p.status = 'Paid'; p.amount = keep; p.kind = 'Deposit captured'; logActivity(p.orderId, `${money(keep)} captured from the deposit`); }
      else { p.status = 'Released'; logActivity(p.orderId, 'Security deposit released'); }
      Store.changed('payments');
      toast(keep > 0 ? `${money(keep)} captured` : 'Deposit released'); render();
    }
  }
});

/* ---------- action bar, entirely derived from the lifecycle ---------- */
function actionBar(o) {
  return Lifecycle.available(o).map(tr =>
    `<button class="btn ${tr.cls}" data-act="order.transition" data-order="${o.id}" data-transition="${tr.id}"${
      tr.title ? ` title="${esc(tr.title)}"` : ''}>${esc(tr.label)}</button>`).join('');
}

/* ---------- tabs ---------- */
function linesTab(o, t) {
  const locked = ['archived', 'canceled'].includes(o.status);
  return `<div class="card"><div class="tbl-wrap"><table class="tbl lines">
    <thead><tr><th>Item</th><th>Qty</th><th>Fulfilled</th><th class="r">Price each</th><th class="r">Charge</th><th class="r">Total</th><th style="width:34px"></th></tr></thead>
    <tbody>${o.lines.map(l => lineRow(l, o, locked)).join('')
      || `<tr class="norow"><td colspan="7">${empty('No items yet', 'Add products, a bundle, a service, or a one-off custom line.')}</td></tr>`}</tbody>
  </table></div>
  ${locked ? '' : `<div class="card-body" style="border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" data-act="order.addProduct" data-order="${o.id}">${icon('plus', 14, 2.2)} Add product</button>
    <button class="btn" data-act="order.addCustom" data-order="${o.id}">${icon('plus', 14, 2.2)} Custom line</button>
    <button class="btn" data-act="order.coupon" data-order="${o.id}">Apply coupon</button>
    <button class="btn" data-act="order.deposit" data-order="${o.id}">Security deposit</button>
  </div>`}
  <div class="card-body" style="border-top:1px solid var(--line);display:flex">
    <div class="totals">
      ${t.rows.map(r => `<div class="tr"><span class="muted">${esc(r.label)}${
        r.id === 'coupon' ? ` <span class="mono">${esc(t.coupon.code)}</span> <button class="x" data-act="order.removeCoupon" data-order="${o.id}" style="padding:1px" aria-label="Remove coupon">${icon('close', 12, 2.4)}</button>` : ''
      }</span><span class="num">${money(r.amount)}</span></div>`).join('')}
      <div class="tr grand"><span>Total</span><span class="num">${money(t.total)}</span></div>
      <div class="tr"><span class="muted">Paid</span><span class="num">${money(t.paid)}</span></div>
      <div class="tr due ${t.due <= 0.01 ? 'settled' : ''}"><span>${t.due <= 0.01 ? 'Settled' : 'Outstanding'}</span><span class="num">${money(Math.max(0, t.due))}</span></div>
      ${o.deposit ? `<div class="tr"><span class="muted">Security deposit (separate)</span><span class="num">${money(o.deposit)}</span></div>` : ''}
    </div>
  </div></div>`;
}

function lineRow(l, o, locked) {
  const p = l.productId ? Data.product(l.productId) : null;
  const units = lineUnits(l, o);
  const avail = p ? availableQty(l.productId, o.startsAt, o.stopsAt, o.id) : null;
  const short = p && l.qty > avail && !['sales', 'service'].includes(p.type);
  return `<tr class="norow">
    <td>
      <div class="pname">${p ? `<a href="#/products/${p.id}" data-go="products" data-param="${p.id}">${esc(l.title)}</a>` : esc(l.title)}</div>
      <div class="psku">${esc(l.sku)}${p ? ` · ${p.track}` : ' · custom line'}${p?.bundle ? ` · bundle of ${p.bundle.length}` : ''}</div>
      ${l.note ? `<div class="dim" style="font-size:11.5px;margin-top:2px">${esc(l.note)}</div>` : ''}
      ${short ? `<div style="margin-top:4px">${chip(`${avail} available — short ${l.qty - avail}`, 'crit')}</div>`
        : p && !['sales', 'service'].includes(p.type) ? `<div class="dim" style="font-size:11px;margin-top:3px">${avail} of ${p.stock} free for these dates</div>` : ''}
    </td>
    <td>${locked ? `<span class="num">${l.qty}</span>`
      : `<input class="qty-in" type="number" min="1" value="${l.qty}" data-field-key="qty" data-field-scope="line:${o.id}:${l.id}">`}</td>
    <td style="font-size:12px">
      ${l.pickedQty ? `${chip(`${l.pickedQty} out`, 'started')}` : ''}
      ${l.returnedQty ? `${chip(`${l.returnedQty} back`, 'stopped')}` : ''}
      ${!l.pickedQty && !l.returnedQty ? '<span class="dim">—</span>' : ''}
      ${l.stockItemIds.length ? `<div class="mono dim" style="font-size:10.5px;margin-top:3px">${
        l.stockItemIds.map(si => esc(Data.stockItems().find(x => x.id === si)?.identifier || '')).join(', ')}</div>` : ''}
    </td>
    <td class="r num">${money(l.priceEach)}</td>
    <td class="r num dim">× ${units}${p?.period === 'day' ? 'd' : ''}</td>
    <td class="r num" style="font-weight:600">${money(lineTotal(l, o))}</td>
    <td>${locked ? '' : `<button class="x" data-act="order.removeLine" data-order="${o.id}" data-line="${l.id}" aria-label="Remove line">${icon('close', 15, 2)}</button>`}</td>
  </tr>`;
}

function documentsTab(o) {
  const docs = documentsFor(o.id);
  return `<div class="card">
    <div class="card-head"><h3>Documents</h3><div class="wrap">
      ${Registry.documentTypes().map(dt =>
        `<button class="btn sm" data-act="document.generate" data-order="${o.id}" data-type="${dt.id}">Generate ${dt.label.toLowerCase()}</button>`).join('')}
    </div></div>
    ${DataTable({
      entity: 'documents', columns: ['number', 'type', 'status', 'date', 'sentTo',
        { key: 'actions', label: 'Actions', align: 'right', type: 'custom',
          render: d => `<div class="wrap" style="justify-content:flex-end">
            <button class="btn sm" data-act="document.preview" data-doc="${d.id}">Preview</button>
            <button class="btn sm" data-act="document.send" data-doc="${d.id}">Send</button>
            ${d.type === 'contract' && !d.signedBy ? `<button class="btn sm" data-act="document.sign" data-doc="${d.id}">Sign</button>` : ''}
          </div>` }],
      rows: docs,
      empty: empty('No documents yet', 'Generate a quote to send the customer a price, or a contract to collect a signature.')
    })}</div>`;
}

function paymentsTab(o, t) {
  return `<div class="card">
    <div class="card-head"><h3>Payments</h3><div class="wrap">
      <button class="btn sm" data-act="payment.new" data-order="${o.id}">Register payment</button>
      <button class="btn sm" data-act="payment.request" data-order="${o.id}">Request payment link</button>
      ${o.deposit ? `<button class="btn sm" data-act="payment.holdDeposit" data-order="${o.id}">Hold deposit</button>` : ''}
    </div></div>
    ${DataTable({
      entity: 'payments', columns: ['when', 'kind', 'method', 'status', 'amount',
        { key: 'act', label: '', align: 'right', type: 'custom',
          render: p => p.status === 'Authorized' ? `<button class="btn sm" data-act="payment.capture" data-payment="${p.id}">Capture / release</button>` : '' }],
      rows: paymentsFor(o.id),
      empty: empty('Nothing paid yet', 'Register a cash or bank payment, or send a payment link.')
    })}
    <div class="card-body" style="border-top:1px solid var(--line)">
      ${banner(t.due > 0.01 ? 'warn' : 'good', t.due > 0.01
        ? `<b>${money(t.due)} outstanding</b> of ${money(t.total)}. ${t.paid ? 'A partial payment is on file.' : 'Nothing has been collected.'}`
        : `<b>Fully settled.</b> ${money(t.paid)} collected against a ${money(t.total)} order.`)}
    </div></div>`;
}

function notesTab(o) {
  const notes = notesFor(o.id);
  return card({
    title: 'Notes',
    head: `<button class="btn sm" data-act="note.add" data-target="order" data-target-id="${o.id}">${icon('plus', 13, 2.4)} Add note</button>`,
    body: notes.length ? notes.map(noteCard).join('')
      : '<div class="dim" style="font-size:13px">Notes are internal — the customer never sees them. Use them for damage, access instructions or anything the next person needs.</div>'
  });
}

function activityTab(o) {
  const list = activityFor(o.id).slice().sort((a, b) => D(b.when) - D(a.when));
  return card({
    title: 'Activity log', head: '<span class="eyebrow">Newest first</span>',
    body: `<div class="tl">${list.length ? list.map(a =>
      `<div class="tl-item ${a.hi ? 'hi' : ''}"><div class="tl-when">${fmtDT(a.when)} · ${esc(a.by)}</div>
       <div class="tl-what">${esc(a.what)}</div></div>`).join('') : '<div class="dim">Nothing logged yet.</div>'}</div>`
  });
}

function fieldsTab(o) {
  const defs = Data.customFields().filter(f => f.entity === 'Order');
  const fields = defs.map(f => ({
    key: `fields.${f.label}`, label: f.label + (f.onDocs ? ' · shown on documents' : ''),
    type: f.type === 'Date' ? 'date' : f.type === 'Number' ? 'number' : 'text', placeholder: '—'
  }));
  const legacy = Object.keys(o.fields).filter(k => !defs.some(f => f.label === k))
    .map(k => ({ key: `fields.${k}`, label: `${k} · legacy field`, type: 'text' }));
  return card({
    title: 'Custom fields',
    head: '<button class="btn sm" data-go="settings" data-param="fields">Manage fields</button>',
    body: Form({ fields: [...fields, ...legacy], record: o, scope: `order:${o.id}` })
  });
}

/* ---------- sidebar ---------- */
function sidebar(o, c, t) {
  return `<aside class="card" style="align-self:start">
    <div class="side-block">
      <div class="lbl">Customer</div>
      <div class="row" style="align-items:flex-start">
        ${avatar(c.name)}
        <div class="grow">
          <a href="#/customers/${c.id}" data-go="customers" data-param="${c.id}" style="font-weight:600">${esc(c.name)}</a>
          <div class="dim" style="font-size:12px">${esc(c.contact)} · ${esc(c.kind)}</div>
          <div class="dim" style="font-size:12px">${esc(c.email)}</div>
          <div class="dim" style="font-size:12px">${esc(c.phone)}</div>
          ${c.discount ? `<div style="margin-top:5px">${chip(`${c.discount}% standing discount`, 'good', false)}</div>` : ''}
          ${c.taxProfile === 'tp_exempt' ? `<div style="margin-top:4px">${chip('Tax exempt', 'plain', false)}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="side-block">
      <div class="lbl">Rental period</div>
      ${Form({ entity: 'orders', fields: ['startsAt', 'stopsAt'], record: o, scope: `order:${o.id}` })}
      <div class="dim" style="font-size:12px;margin-top:7px">Changing dates re-checks availability and re-prices every line.</div>
    </div>
    <div class="side-block">
      <div class="lbl">Fulfilment</div>
      ${row('Picked up', `<span class="num">${pickedItems(o)} / ${totalItems(o)}</span>`)}
      ${row('Returned', `<span class="num">${returnedItems(o)} / ${totalItems(o)}</span>`)}
      ${row('Location', esc(Data.location(o.locationId).name))}
      ${row('Signature', o.signature ? chip(o.signature, 'good', false)
        : `<button class="btn sm" data-act="order.sign" data-order="${o.id}">Collect</button>`)}
    </div>
    <div class="side-block">
      <div class="lbl">Money</div>
      ${row('Total', `<span class="num" style="font-weight:600">${money(t.total)}</span>`)}
      ${row('Paid', `<span class="num">${money(t.paid)}</span>`)}
      ${row('Outstanding', `<span class="num" style="font-weight:700;color:${t.due > 0.01 ? 'var(--crit)' : 'var(--good)'}">${money(Math.max(0, t.due))}</span>`)}
      ${o.deposit ? row('Deposit', `<span class="num">${money(o.deposit)}</span> ${t.heldDeposit ? chip('held', 'info', false) : ''}`) : ''}
      <button class="btn primary" style="width:100%;margin-top:10px" data-act="payment.new" data-order="${o.id}">${icon('money', 15, 2)} New payment</button>
    </div>
  </aside>`;
}
const row = (k, v) => `<div class="spread" style="font-size:13px;margin-top:4px"><span class="muted">${esc(k)}</span><span>${v}</span></div>`;

/* ---------- modals ---------- */
const newLine = p => ({ id: uid('ln'), kind: 'product', productId: p.id, title: p.name, sku: p.sku,
  qty: 1, priceEach: p.price, taxProfile: p.taxProfile, pickedQty: 0, returnedQty: 0, stockItemIds: [] });

function openNewOrder(customerId, productId, render) {
  const d = Data.orderDefaults();
  const start = new Date(); start.setHours(+d.pickupTime.slice(0, 2), 0, 0, 0);
  const stop = new Date(start); stop.setDate(stop.getDate() + 1); stop.setHours(+d.returnTime.slice(0, 2), 0, 0, 0);
  const iso = x => new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  Modal.open({
    title: 'New order', sub: 'Pick a customer and a rental period — items come next.',
    body: `<div class="grid2">
      <div class="field"><label>Customer</label><select id="no-cust"><option value="">— choose a customer —</option>
        ${Data.customers().map(c => `<option value="${c.id}"${customerId === c.id ? ' selected' : ''}>${esc(c.name)} · ${esc(c.number)}</option>`).join('')}</select></div>
      <div class="field"><label>Location</label><select id="no-loc">
        ${Data.locations().filter(l => l.type !== 'Inventory only').map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Starts</label><input type="datetime-local" id="no-start" value="${iso(start)}"></div>
      <div class="field"><label>Stops</label><input type="datetime-local" id="no-stop" value="${iso(stop)}"></div>
    </div>
    <div class="field" style="margin-top:14px"><label>Source</label><select id="no-src">
      <option>Back office</option><option>Mobile POS</option><option>Online store</option></select></div>
    ${banner('info', 'Saving as a <b>concept</b> holds nothing — useful while a quote is out. <b>Reserve</b> takes the stock off the shelf immediately.')}`,
    foot: `<button class="btn" data-close-modal>Cancel</button>
      <button class="btn" data-act="order.create" data-mode="concept"${productId ? ` data-product="${productId}"` : ''}>Save as concept</button>
      <button class="btn primary" data-act="order.create" data-mode="reserved"${productId ? ` data-product="${productId}"` : ''}>Create & reserve</button>`
  });
  void render;
}

function createOrder(mode, productId, go) {
  const customerId = document.querySelector('#no-cust').value;
  if (!customerId) return toast('Pick a customer first', 'bad');
  const seq = (Store.config('orderSequence') || 1059) + 1;
  Store.setConfig('orderSequence', seq);
  const order = {
    id: uid('o'), number: seq, status: mode, customerId,
    source: document.querySelector('#no-src').value,
    locationId: document.querySelector('#no-loc').value,
    startsAt: new Date(document.querySelector('#no-start').value).toISOString(),
    stopsAt: new Date(document.querySelector('#no-stop').value).toISOString(),
    createdAt: new Date().toISOString(), deposit: 0, couponId: null,
    lines: [], fields: {}, tags: [], signature: null, signedAt: null
  };
  if (productId) { const p = Data.product(productId); order.lines.push(newLine(p)); order.deposit = p.deposit; }
  Store.insert('orders', order);
  logActivity(order.id, 'Order created from the back office');
  if (mode === 'reserved') logActivity(order.id, 'Status changed to Reserved', true);
  Modal.close();
  toast(`Order #${order.number} created`);
  go('orders', order.id);
}

function duplicateOrder(o, go) {
  const seq = (Store.config('orderSequence') || 1059) + 1;
  Store.setConfig('orderSequence', seq);
  const copy = JSON.parse(JSON.stringify(o));
  Object.assign(copy, { id: uid('o'), number: seq, status: 'concept', createdAt: new Date().toISOString(),
    signature: null, signedAt: null, shortages: undefined });
  copy.lines.forEach(l => { l.id = uid('ln'); l.pickedQty = 0; l.returnedQty = 0; l.stockItemIds = []; });
  Store.insert('orders', copy);
  logActivity(copy.id, `Duplicated from order #${o.number}`);
  toast(`Created #${copy.number} as a concept`);
  go('orders', copy.id);
}

function openProductPicker(o) {
  Modal.open({
    title: 'Add products', sub: `Availability shown for ${fmtD(o.startsAt)} → ${fmtD(o.stopsAt)}`, size: 'wide',
    body: `<div class="search" style="margin-bottom:12px">${icon('search', 15, 2)}
        <input placeholder="Search products…" id="picker-q" autofocus></div>
      <div id="picker-list">${productPickerList(o, '')}</div>`,
    foot: '<button class="btn" data-close-modal>Done</button>',
    onMount: root => {
      const q = root.querySelector('#picker-q');
      q.addEventListener('input', () => { root.querySelector('#picker-list').innerHTML = productPickerList(o, q.value); });
    }
  });
}
function productPickerList(o, q) {
  q = q.toLowerCase();
  return Data.products()
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    .slice(0, 40).map(p => {
      const a = availableQty(p.id, o.startsAt, o.stopsAt, o.id);
      const on = o.lines.find(l => l.productId === p.id);
      return `<div class="picker-item ${on ? 'sel' : ''}" data-act="order.pickProduct" data-product="${p.id}" data-order="${o.id}">
        <span class="thumb">${p.icon}</span>
        <div class="grow"><div style="font-weight:600">${esc(p.name)}</div>
          <div class="mono dim" style="font-size:11.5px">${esc(p.sku)} · ${money(p.price)}/${p.period}${p.deposit ? ` · ${money(p.deposit)} deposit` : ''}</div></div>
        ${['rental', 'bundle'].includes(p.type) ? chip(`${a} free`, a <= 0 ? 'crit' : a <= 2 ? 'warn' : 'good', false) : chip(p.type, 'plain', false)}
        ${on ? chip(`${on.qty} on order`, 'info', false) : ''}
      </div>`;
    }).join('') || empty('No products match');
}

function openPickup(o) {
  const rows = o.lines.filter(l => l.pickedQty < l.qty);
  Modal.open({
    title: `Pick up items · #${o.number}`, size: 'wide',
    sub: 'Tick what is physically going out. Trackable products need a specific unit.',
    body: `${banner('info', 'Scan each barcode or tick by hand. A partial pickup puts the order into <b>Mixed</b> — the rest stays reserved.')}
      <div style="margin-top:14px"></div>
      ${rows.map(l => {
        const p = l.productId ? Data.product(l.productId) : null;
        const free = p && p.track === 'trackable'
          ? Data.stockItems().filter(si => si.productId === p.id && si.condition !== 'maintenance'
              && !Data.orders().some(oo => oo.id !== o.id && oo.lines.some(ll => ll.stockItemIds.includes(si.id))))
          : [];
        const need = l.qty - l.pickedQty;
        return `<div class="checkline on" style="align-items:flex-start;flex-direction:column;gap:8px">
          <div class="row" style="width:100%"><input type="checkbox" checked data-pick="${l.id}">
            <div class="grow"><div style="font-weight:600">${esc(l.title)}</div>
              <div class="mono dim" style="font-size:11.5px">${esc(l.sku)} · ${need} to go out</div></div>
            <input class="qty-in" type="number" min="0" max="${need}" value="${need}" data-pick-qty="${l.id}"></div>
          ${p && p.track === 'trackable' ? `<div class="wrap" style="padding-left:26px">
            ${free.slice(0, Math.max(3, l.qty)).map((si, i) => `<label class="chip ${i < need ? 'good' : 'plain'}" style="cursor:pointer">
              <input type="checkbox"${i < need ? ' checked' : ''} data-pick-item="${l.id}" value="${si.id}" style="margin-right:4px">
              <span class="mono">${esc(si.identifier)}</span></label>`).join('')
              || '<span class="dim" style="font-size:12px">No free units — this line is short.</span>'}
          </div>` : ''}
        </div>`;
      }).join('') || empty('Everything on this order is already out.')}
      <div class="field" style="margin-top:14px"><label>Signature</label>
        <canvas class="sigpad" id="sigpad" width="560" height="130"></canvas>
        <span class="hint">The customer signs here. Required before pickup by your order settings.</span></div>`,
    foot: `<button class="btn" data-close-modal>Cancel</button>
      <button class="btn ghost" data-act="order.clearSignature">Clear signature</button>
      <button class="btn pick" data-act="order.confirmPickup" data-order="${o.id}">Pick up items</button>`,
    onMount: root => initSigpad(root.querySelector('#sigpad'))
  });
}

function confirmPickup(o, render) {
  const root = document.getElementById('modal-root');
  let n = 0;
  o.lines.forEach(l => {
    const cb = root.querySelector(`[data-pick="${l.id}"]`);
    if (!cb || !cb.checked) return;
    const q = Math.min(l.qty - l.pickedQty, +root.querySelector(`[data-pick-qty="${l.id}"]`).value || 0);
    if (q <= 0) return;
    l.pickedQty += q; n += q;
    root.querySelectorAll(`[data-pick-item="${l.id}"]:checked`)
      .forEach(x => { if (!l.stockItemIds.includes(x.value)) l.stockItemIds.push(x.value); });
  });
  if (!n) return toast('Nothing was ticked', 'bad');
  const sig = root.querySelector('#sigpad');
  if (sig?.dataset.signed) {
    o.signature = Data.customer(o.customerId).contact;
    o.signedAt = new Date().toISOString();
    const contract = documentsFor(o.id).find(d => d.type === 'contract');
    if (contract) { contract.signedBy = o.signature; contract.status = 'Signed'; }
  }
  o.status = deriveStatus(o);
  Store.changed('orders');
  logActivity(o.id, `${n} item${n > 1 ? 's' : ''} picked up — status changed to ${Lifecycle.label(o.status)}`, true);
  Modal.close();
  toast(`${n} item${n > 1 ? 's' : ''} handed over`);
  render();
}

function openReturn(o) {
  const rows = o.lines.filter(l => l.returnedQty < l.pickedQty);
  Modal.open({
    title: `Return items · #${o.number}`, size: 'wide',
    sub: 'Tick what came back. Anything you leave unticked stays out.',
    body: `${rows.map(l => `<div class="checkline on">
        <input type="checkbox" checked data-ret="${l.id}">
        <div class="grow"><div style="font-weight:600">${esc(l.title)}</div>
          <div class="mono dim" style="font-size:11.5px">${esc(l.sku)} · ${l.pickedQty - l.returnedQty} still out</div></div>
        <input class="qty-in" type="number" min="0" max="${l.pickedQty - l.returnedQty}" value="${l.pickedQty - l.returnedQty}" data-ret-qty="${l.id}">
      </div>`).join('') || empty('Nothing is out on this order.')}
      <div class="grid2" style="margin-top:16px">
        <div class="field"><label>Withhold from deposit</label>
          <input type="number" value="0" id="ret-damage"${o.deposit ? '' : ' disabled'}>
          <span class="hint">${o.deposit ? `${money(o.deposit)} is held. Anything you withhold is captured; the rest is released.` : 'No deposit on this order.'}</span></div>
        <div class="field"><label>Damage / condition note</label>
          <input id="ret-note" placeholder="e.g. lens hood cracked, charged $40"></div>
      </div>`,
    foot: `<button class="btn" data-close-modal>Cancel</button>
      <button class="btn ret" data-act="order.confirmReturn" data-order="${o.id}">Return items</button>`
  });
}

function confirmReturn(o, render) {
  const root = document.getElementById('modal-root');
  let n = 0;
  o.lines.forEach(l => {
    const cb = root.querySelector(`[data-ret="${l.id}"]`);
    if (!cb || !cb.checked) return;
    const q = Math.min(l.pickedQty - l.returnedQty, +root.querySelector(`[data-ret-qty="${l.id}"]`).value || 0);
    if (q <= 0) return;
    l.returnedQty += q; n += q;
  });
  if (!n) return toast('Nothing was ticked', 'bad');
  const damage = +(document.querySelector('#ret-damage')?.value || 0);
  const note = document.querySelector('#ret-note')?.value || '';
  o.status = deriveStatus(o);
  const hold = paymentsFor(o.id).find(p => p.kind === 'Security deposit hold' && p.status === 'Authorized');
  if (hold) {
    if (damage > 0) { hold.status = 'Paid'; hold.amount = damage; hold.kind = 'Deposit captured (damage)'; }
    else hold.status = 'Released';
  }
  if (note) Store.insert('notes', { id: uid('nt'), target: 'order', targetId: o.id,
    body: 'Return note: ' + note, by: Data.me().name, when: new Date().toISOString() });
  Store.changed('orders');
  logActivity(o.id, `${n} item${n > 1 ? 's' : ''} returned — status changed to ${Lifecycle.label(o.status)}`, true);
  if (damage > 0) logActivity(o.id, `${money(damage)} withheld from the security deposit`);
  else if (hold) logActivity(o.id, 'Security deposit released');
  Modal.close();
  toast(`${n} item${n > 1 ? 's' : ''} back in stock`);
  render();
}

function openPayment(o) {
  const t = orderTotals(o);
  Modal.open({
    title: 'Register a payment', size: 'narrow',
    sub: `#${o.number} · ${money(Math.max(0, t.due))} outstanding`,
    body: `<div class="field"><label>Amount</label><input type="number" id="pay-amt" value="${Math.max(0, t.due).toFixed(2)}"></div>
      <div class="field" style="margin-top:12px"><label>Method</label><select id="pay-method">
        <option>Credit card</option><option>Cash</option><option>Bank transfer</option><option>Check</option><option>Tap to Pay</option></select></div>
      <div class="field" style="margin-top:12px"><label>Kind</label><select id="pay-kind">
        <option>Full payment</option><option>Down payment</option><option>Partial payment</option><option>Security deposit hold</option></select></div>`,
    foot: `<button class="btn" data-close-modal>Cancel</button>
      <button class="btn primary" data-act="payment.confirm" data-order="${o.id}">Register</button>`
  });
}

function confirmPayment(o, render) {
  const amount = +document.querySelector('#pay-amt').value || 0;
  const method = document.querySelector('#pay-method').value;
  const kind = document.querySelector('#pay-kind').value;
  if (amount <= 0) return toast('Enter an amount', 'bad');
  Store.insert('payments', { id: uid('pay'), orderId: o.id, amount, method, kind,
    when: new Date().toISOString(), status: kind === 'Security deposit hold' ? 'Authorized' : 'Paid' });
  logActivity(o.id, `${kind} of ${money(amount)} registered (${method})`);
  const invoice = documentsFor(o.id).find(d => d.type === 'invoice');
  if (invoice) {
    const t = orderTotals(o);
    invoice.status = t.due <= 0.01 ? 'Paid' : t.paid > 0 ? 'Partially paid' : invoice.status;
  }
  Modal.close();
  toast(`${money(amount)} registered`);
  render();
}

export function initSigpad(cv) {
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let drawing = false;
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#000';
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pt = e => {
    const r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return [(t.clientX - r.left) * (cv.width / r.width), (t.clientY - r.top) * (cv.height / r.height)];
  };
  const start = e => { drawing = true; ctx.beginPath(); ctx.moveTo(...pt(e)); e.preventDefault(); };
  const move = e => { if (!drawing) return; ctx.lineTo(...pt(e)); ctx.stroke(); e.preventDefault(); };
  const end = () => { drawing = false; cv.dataset.signed = '1'; };
  cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  cv.addEventListener('touchstart', start); cv.addEventListener('touchmove', move); cv.addEventListener('touchend', end);
}

/* Field write-back for orders and their lines. The shell only announces
   "a field with this scope changed"; interpreting the scope is the
   module's job, so no screen knowledge leaks into core. */
Registry.hook('field-input', ({ scope, key, value }) => {
  if (!scope) return;
  if (scope.startsWith('order:')) {
    const o = Data.order(scope.slice(6));
    if (!o) return;
    setValue(o, key, /At$/.test(key) && value ? new Date(value).toISOString() : value);
    Store.changed('orders');
    if (/At$/.test(key)) { logActivity(o.id, 'Rental period changed — re-priced and availability re-checked'); render(); }
    return;
  }
  if (scope.startsWith('line:')) {
    const [, orderId, lineId] = scope.split(':');
    const o = Data.order(orderId);
    const line = o?.lines.find(l => l.id === lineId);
    if (!line) return;
    line.qty = Math.max(1, +value || 1);
    Store.changed('orders');
    const el = document.querySelector(`[data-field-scope="${scope}"]`);
    const pos = el?.selectionStart;
    render();
    const again = document.querySelector(`[data-field-scope="${scope}"]`);
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* number input */ } }
  }
});
export { paymentsFor, notesFor, activityFor, createDocument };
