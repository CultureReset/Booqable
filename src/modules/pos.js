/* The mobile POS is a module like any other — it just declares
   `device`, which puts it in the top-bar device switcher instead of the
   sidebar and lets it own the whole viewport. It reads the same Store
   and drives the same lifecycle transitions as the web screens. */

import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { esc, uid, D, sameDay, addDays } from '../core/util.js';
import { icon, chip, card, toast, banner } from '../core/ui.js';
import { money, fmtD, fmtT } from '../core/fields.js';
import { Lifecycle, deriveStatus, isLate, totalItems } from '../schema/lifecycle.js';
import { orderTotals } from '../schema/pricing.js';
import { orderShortages, availableOnDay } from '../schema/availability.js';
import { logActivity } from './orders.js';

const DATE_FILTERS = [
  { id: 'today', label: 'Today', match: o => sameDay(D(o.startsAt), new Date()) || sameDay(D(o.stopsAt), new Date()) || isLate(o) },
  { id: 'tomorrow', label: 'Tomorrow', match: o => sameDay(D(o.startsAt), addDays(new Date(), 1)) || sameDay(D(o.stopsAt), addDays(new Date(), 1)) },
  { id: 'upcoming', label: 'Upcoming', match: o => D(o.startsAt) > new Date() },
  { id: 'late', label: 'Late', match: isLate }
];
const LABEL_FILTERS = [
  { id: 'all', label: 'All orders', match: () => true },
  { id: 'pickup', label: 'To pick up', match: o => o.status === 'reserved' },
  { id: 'return', label: 'To return', match: o => ['started', 'mixed'].includes(o.status) },
  { id: 'short', label: 'Shortage', match: o => orderShortages(o).length > 0 }
];
const TABS = [
  { id: 'dashboard', label: 'Orders', icon: 'orders' },
  { id: 'scan', label: 'Scan', icon: 'scan' },
  { id: 'products', label: 'Look up', icon: 'products' },
  { id: 'more', label: 'More', icon: 'settings' }
];

const posOrders = S => {
  const dateF = DATE_FILTERS.find(f => f.id === (S.scratch.posDate || 'today')) || DATE_FILTERS[0];
  const labelF = LABEL_FILTERS.find(f => f.id === (S.scratch.posLabel || 'all')) || LABEL_FILTERS[0];
  const q = (S.query.pos || '').toLowerCase();
  return Data.orders()
    .filter(o => Lifecycle.state(o.status).holdsStock)
    .filter(dateF.match).filter(labelF.match)
    .filter(o => !q || String(o.number).includes(q)
      || Data.customer(o.customerId).name.toLowerCase().includes(q)
      || o.lines.some(l => l.title.toLowerCase().includes(q)))
    .sort((a, b) => D(a.status === 'reserved' ? a.startsAt : a.stopsAt) - D(b.status === 'reserved' ? b.startsAt : b.stopsAt));
};

Registry.module({
  id: 'pos', label: 'Mobile POS', icon: 'apps', device: 'pos', hidden: true, order: 130,

  render({ S }) {
    return `<div style="padding:22px;min-height:100vh;background:var(--canvas)">
      <div class="spread" style="max-width:1180px;margin:0 auto 18px;flex-wrap:wrap;gap:12px">
        <div><h1 class="page-title">Mobile Point of Sale</h1>
          <div class="page-sub">The same account, on the warehouse counter. Everything below is live — it writes to the same orders as the web dashboard.</div></div>
        <div class="btn-group"><button data-device="desktop">Web</button><button class="on" data-device="pos">Mobile POS</button></div>
      </div>
      <div class="pos-stage" style="max-width:1180px;margin:0 auto">
        <div class="phone"><div class="phone-notch"></div><div class="phone-screen">
          <div class="pos-status"><span>9:41</span><span>${esc(Data.location('loc_pdx').code)} · ▮▮▮</span></div>
          ${S.scratch.posScan ? scanner()
            : S.scratch.posOrder ? orderView(Data.order(S.scratch.posOrder))
            : screen(S)}
          <div class="pos-tabbar">
            ${TABS.map(t => `<button class="${(S.scratch.posTab || 'dashboard') === t.id ? 'on' : ''}" data-act="pos.tab" data-tab-id="${t.id}">
              ${icon(t.icon, 19, 1.8)}<span>${t.label}</span></button>`).join('')}
          </div>
        </div></div>
        <div class="device-notes stack">
          ${card({ title: 'What the POS is for', body: `
            <p class="muted" style="font-size:13px;margin:0 0 10px">Warehouse staff do not build orders — they move equipment. Every control on this screen exists to answer one of three questions, fast, one-handed, at a counter:</p>
            <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--text-2);display:flex;flex-direction:column;gap:6px">
              <li><b style="color:var(--text)">Who is here?</b> — filter by today / tomorrow / upcoming / late, or scan the customer's QR code.</li>
              <li><b style="color:var(--text)">What do they get?</b> — open the order, scan each item's barcode against the line, hand it over.</li>
              <li><b style="color:var(--text)">Are they square?</b> — the Pay button shows outstanding balance before anything leaves the building.</li>
            </ul>
            <div style="margin-top:12px">${banner('info', 'Card payments and full order editing stay on the web dashboard. The POS deliberately cannot change prices.')}</div>` })}
          ${card({ title: 'Try it', body: `
            <div class="wrap">
              <button class="btn sm" data-act="pos.filter" data-kind="posDate" data-value="late">Show late orders</button>
              <button class="btn sm" data-act="pos.filter" data-kind="posLabel" data-value="pickup">Only pickups</button>
              <button class="btn sm" data-act="pos.scan">Open the scanner</button>
              <button class="btn sm" data-act="pos.tab" data-tab-id="products">Look up a product</button>
            </div>
            <div class="dim" style="font-size:12.5px;margin-top:10px">Picking an order up or returning it here changes its status everywhere — switch back to Web and the dashboard, calendar and reports all move with it.</div>` })}
        </div>
      </div>
    </div>`;
  },

  actions: {
    'pos.tab': ({ data, S, render }) => {
      S.scratch.posTab = data.tabId;
      S.scratch.posScan = data.tabId === 'scan';
      S.scratch.posOrder = null;
      render();
    },
    'pos.filter': ({ data, S, render }) => { S.scratch[data.kind] = data.value; render(); },
    'pos.open': ({ data, S, render }) => { S.scratch.posOrder = data.order; render(); },
    'pos.back': ({ S, render }) => { S.scratch.posOrder = null; render(); },
    'pos.scan': ({ S, render }) => { S.scratch.posScan = true; render(); },
    'pos.scanClose': ({ S, render }) => { S.scratch.posScan = false; S.scratch.posTab = 'dashboard'; render(); },
    'pos.scanHit': ({ data, S, render }) => {
      const si = Data.stockItems().find(x => x.id === data.stock);
      S.scratch.posScan = false; S.scratch.posTab = 'dashboard';
      const onOrder = Data.orders().find(o => Lifecycle.state(o.status).holdsStock && o.lines.some(l => l.productId === si.productId));
      if (onOrder) { S.scratch.posOrder = onOrder.id; toast(`${si.identifier} → order #${onOrder.number}`); }
      else toast(`${si.identifier} · ${Data.product(si.productId).name} — in stock, not on an order`);
      render();
    },

    /* The POS drives the same lifecycle the web screens do. */
    'pos.pickup': ({ data, render }) => {
      const o = Data.order(data.order);
      o.lines.forEach(l => { l.pickedQty = l.qty; });
      o.status = deriveStatus(o);
      o.signature ||= Data.customer(o.customerId).contact;
      o.signedAt ||= new Date().toISOString();
      Store.changed('orders');
      logActivity(o.id, 'All items picked up on the mobile POS', true);
      toast(`#${o.number} picked up`); render();
    },
    'pos.return': ({ data, render }) => {
      const o = Data.order(data.order);
      o.lines.forEach(l => { l.pickedQty = l.qty; l.returnedQty = l.qty; });
      o.status = deriveStatus(o);
      const hold = Data.payments().find(p => p.orderId === o.id && p.kind === 'Security deposit hold' && p.status === 'Authorized');
      if (hold) hold.status = 'Released';
      Store.changed('orders');
      logActivity(o.id, 'All items returned on the mobile POS', true);
      toast(`#${o.number} returned`); render();
    },
    'pos.pay': ({ data, render }) => {
      const o = Data.order(data.order);
      const t = orderTotals(o);
      if (t.due <= 0.01) return toast('Already settled');
      Store.insert('payments', { id: uid('pay'), orderId: o.id, amount: t.due, method: 'Tap to Pay',
        kind: 'Full payment', when: new Date().toISOString(), status: 'Paid' });
      logActivity(o.id, `${money(t.due)} taken on the mobile POS (Tap to Pay)`);
      toast(`${money(t.due)} taken`); render();
    },
    'pos.cancel': ({ data, render }) => {
      const o = Data.order(data.order);
      if (!confirm(`Cancel #${o.number}?`)) return;
      o.status = 'canceled';
      Store.changed('orders');
      logActivity(o.id, 'Canceled on the mobile POS', true);
      toast('Canceled'); render();
    }
  }
});

function screen(S) {
  const tab = S.scratch.posTab || 'dashboard';
  if (tab === 'products') return productLookup(S);
  if (tab === 'more') return more();
  return orderList(S);
}

function orderList(S) {
  const list = posOrders(S);
  const dateF = S.scratch.posDate || 'today';
  const labelF = S.scratch.posLabel || 'all';
  return `<div class="pos-top">
    <div class="row"><div class="search grow">${icon('search', 14, 2)}
      <input placeholder="Order #, customer or product…" value="${esc(S.query.pos || '')}" data-search="pos"></div>
      <button class="btn sm" data-act="pos.scan" aria-label="Scan">${icon('scan', 16, 1.9)}</button></div>
    <div class="pos-filters">${DATE_FILTERS.map(f =>
      `<button class="${dateF === f.id ? 'on' : ''}" data-act="pos.filter" data-kind="posDate" data-value="${f.id}">${f.label}</button>`).join('')}</div>
    <div class="pos-filters">${LABEL_FILTERS.map(f =>
      `<button class="${labelF === f.id ? 'on' : ''}" data-act="pos.filter" data-kind="posLabel" data-value="${f.id}">${f.label}</button>`).join('')}</div>
  </div>
  <div class="pos-body">
    ${list.length ? list.map(o => {
      const c = Data.customer(o.customerId);
      const t = orderTotals(o);
      const late = isLate(o);
      const dir = o.status === 'reserved' ? 'out' : 'in';
      return `<div class="pos-card" data-act="pos.open" data-order="${o.id}">
        <div class="hdr">
          <div><div style="font-weight:600;font-size:13.5px">${esc(c.name)}</div>
            <div class="mono dim" style="font-size:11.5px">#${o.number} · ${totalItems(o)} items</div></div>
          ${chip(late ? (dir === 'out' ? 'Late' : 'Overdue') : Lifecycle.label(o.status), late ? 'crit' : Lifecycle.tone(o.status))}
        </div>
        <div class="spread" style="margin-top:7px;font-size:12px">
          <span class="muted">${dir === 'out' ? 'Out' : 'Back'} ${fmtD(dir === 'out' ? o.startsAt : o.stopsAt)} ${fmtT(dir === 'out' ? o.startsAt : o.stopsAt)}</span>
          ${orderShortages(o).length ? chip('Shortage', 'crit', false) : ''}
        </div>
        <div class="pos-actions" onclick="event.stopPropagation()">
          <button class="btn ${t.due > 0.01 ? 'pay' : ''}" data-act="pos.pay" data-order="${o.id}">${t.due > 0.01 ? 'Pay ' + money(t.due) : 'Paid'}</button>
          ${dir === 'out'
            ? `<button class="btn pick" data-act="pos.pickup" data-order="${o.id}">Pick up</button>`
            : `<button class="btn ret" data-act="pos.return" data-order="${o.id}">Return</button>`}
        </div>
        ${late && dir === 'out' ? `<button class="btn sm ghost" style="width:100%;margin-top:6px;color:var(--crit)" data-act="pos.cancel" data-order="${o.id}">Cancel this order</button>` : ''}
      </div>`;
    }).join('') : `<div class="pos-notes" style="text-align:center;padding-top:40px">
      <div style="font-family:var(--display);font-weight:600;margin-bottom:4px">Nothing here</div>
      <div style="font-size:12.5px">No orders match this filter.</div></div>`}
  </div>`;
}

function productLookup(S) {
  const q = (S.query.pos || '').toLowerCase();
  const list = Data.products().filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  return `<div class="pos-top">
    <div class="row"><div class="search grow">${icon('search', 14, 2)}
      <input placeholder="Product or SKU…" value="${esc(S.query.pos || '')}" data-search="pos"></div>
      <button class="btn sm" data-act="pos.scan">${icon('scan', 16, 1.9)}</button></div></div>
  <div class="pos-body">
    ${list.slice(0, 14).map(p => {
      const a = availableOnDay(p.id, new Date());
      return `<div class="pos-card"><div class="hdr">
        <div class="row"><span class="thumb">${p.icon}</span>
          <div><div style="font-weight:600;font-size:13px">${esc(p.name)}</div>
            <div class="mono dim" style="font-size:11px">${esc(p.sku)}</div></div></div>
        ${chip(p.type === 'service' ? 'n/a' : `${a} free`, a <= 0 ? 'crit' : a <= p.stock * .25 ? 'warn' : 'good', false)}</div>
        <div class="spread" style="margin-top:8px;font-size:12px">
          <span class="muted">${money(p.price)} / ${esc(p.period)}</span>
          <span class="dim">${p.type === 'service' ? 'service' : p.stock + ' owned'}</span></div></div>`;
    }).join('')}
  </div>`;
}

function more() {
  const me = Data.me();
  return `<div class="pos-top"><div style="font-weight:600">More</div></div>
    <div class="pos-body">
      ${[['Location', 'Portland Warehouse'], ['Signed in as', me.name], ['Role', me.role],
         ['Data source', Store.adapterName()], ['Offline queue', '0 pending'], ['App version', '4.12.2 (build 8841)']]
        .map(([k, v]) => `<div class="pos-card"><div class="spread">
          <span class="muted" style="font-size:12.5px">${esc(k)}</span>
          <span style="font-weight:500;font-size:12.5px">${esc(v)}</span></div></div>`).join('')}
      <div class="pos-card"><div style="font-weight:600;font-size:13px;margin-bottom:6px">Not available on mobile</div>
        <div class="dim" style="font-size:12px;line-height:1.7">Pricing changes · Reports · Settings · Document templates · Team management. These live on the web dashboard by design.</div></div>
    </div>`;
}

function scanner() {
  return `<div class="scanner">
    <div style="font-family:var(--display);font-weight:600;font-size:16px">Scan a code</div>
    <div class="scan-box"><div class="scan-line"></div></div>
    <div style="font-size:12.5px;opacity:.8;text-align:center;max-width:230px">Works on order QR codes, customer cards and item barcodes. Point at the label on the case.</div>
    <div class="wrap" style="justify-content:center">
      ${Data.stockItems().slice(0, 3).map(si =>
        `<button class="btn sm" data-act="pos.scanHit" data-stock="${si.id}">Simulate ${esc(si.identifier)}</button>`).join('')}
    </div>
    <button class="btn" data-act="pos.scanClose">Close scanner</button>
  </div>`;
}

function orderView(o) {
  const c = Data.customer(o.customerId);
  const t = orderTotals(o);
  return `<div class="pos-top">
    <div class="row"><button class="btn sm ghost" data-act="pos.back">←</button>
      <div class="grow"><div style="font-weight:600;font-size:13.5px">${esc(c.name)}</div>
        <div class="mono dim" style="font-size:11.5px">#${o.number}</div></div>
      ${chip(Lifecycle.label(o.status), Lifecycle.tone(o.status))}</div>
  </div>
  <div class="pos-body">
    <div class="pos-card">
      <div class="spread" style="font-size:12.5px"><span class="muted">Out</span><span>${fmtD(o.startsAt)} ${fmtT(o.startsAt)}</span></div>
      <div class="spread" style="font-size:12.5px;margin-top:4px"><span class="muted">Back</span><span>${fmtD(o.stopsAt)} ${fmtT(o.stopsAt)}</span></div>
      <div class="spread" style="font-size:12.5px;margin-top:4px"><span class="muted">Outstanding</span>
        <span class="num" style="font-weight:700;color:${t.due > 0.01 ? 'var(--crit)' : 'var(--good)'}">${money(Math.max(0, t.due))}</span></div></div>
    ${o.lines.map(l => `<div class="pos-card"><div class="spread">
      <div class="grow"><div style="font-weight:500;font-size:13px">${esc(l.title)}</div>
        <div class="mono dim" style="font-size:11px">${esc(l.sku)}</div></div>
      <div style="text-align:right"><div class="num" style="font-weight:600">${l.qty}×</div>
        ${l.returnedQty ? chip(`${l.returnedQty} back`, 'stopped', false) : l.pickedQty ? chip(`${l.pickedQty} out`, 'started', false) : ''}</div>
    </div></div>`).join('')}
    <div class="pos-actions">
      <button class="btn ${t.due > 0.01 ? 'pay' : ''}" data-act="pos.pay" data-order="${o.id}">${t.due > 0.01 ? 'Take payment' : 'Paid'}</button>
      ${o.status === 'reserved' ? `<button class="btn pick" data-act="pos.pickup" data-order="${o.id}">Pick up all</button>`
        : ['started', 'mixed'].includes(o.status) ? `<button class="btn ret" data-act="pos.return" data-order="${o.id}">Return all</button>` : ''}
    </div>
  </div>`;
}
