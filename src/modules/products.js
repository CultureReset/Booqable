import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { esc, uid, pad, hashCode, addDays, sum } from '../core/util.js';
import { pageHead, tile, card, empty, toast, icon, chip, tabs, banner, Modal } from '../core/ui.js';
import { money, money0, fmtDY, setValue } from '../core/fields.js';
import { DataTable, Form } from '../core/view.js';
import { render } from '../core/app.js';
import { Lifecycle } from '../schema/lifecycle.js';
import { orderTotals, lineTotal, chargeUnits } from '../schema/pricing.js';
import { availableOnDay, availableQty, utilisationTone } from '../schema/availability.js';
import { noteCard } from './dashboard.js';

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'rental', label: 'Rentals', match: p => p.type === 'rental' },
  { id: 'sales', label: 'Sales items', match: p => p.type === 'sales' },
  { id: 'service', label: 'Services', match: p => p.type === 'service' },
  { id: 'bundle', label: 'Bundles', match: p => p.type === 'bundle' },
  { id: 'short', label: 'Shortages', match: p => availableOnDay(p.id, new Date()) < 0 },
  { id: 'maint', label: 'In maintenance', match: p => Data.stockItems().some(si => si.productId === p.id && si.condition === 'maintenance') }
];
const LIST_COLUMNS = ['name', 'type', 'track', 'collection', 'stock', 'free', 'price', 'deposit'];

const PRODUCT_TABS = [
  { id: 'general', label: 'General', render: generalTab },
  { id: 'pricing', label: 'Pricing', render: pricingTab },
  { id: 'inventory', label: 'Inventory', count: p => itemsFor(p).length, render: inventoryTab },
  { id: 'availability', label: 'Availability', render: availabilityTab },
  { id: 'online', label: 'Online store', render: onlineTab },
  { id: 'notes', label: 'Notes', count: p => notesFor(p).length, render: notesTab }
];
const itemsFor = p => Data.stockItems().filter(si => si.productId === p.id);
const notesFor = p => Data.notes().filter(n => n.target === 'product' && n.targetId === p.id);

Registry.module({
  id: 'products', label: 'Products', icon: 'products', order: 60, group: 'Manage',
  entity: 'products',

  render({ S, tabState }) {
    const filter = tabState('products.filter', 'all');
    const view = tabState('products.view', 'table');
    const q = (S.query['products'] || '').trim().toLowerCase();
    const f = FILTERS.find(x => x.id === filter) || FILTERS[0];
    const rows = Data.products().filter(f.match)
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));

    return `
    ${pageHead({
      title: 'Products',
      sub: `${Data.products().length} products · ${Data.stockItems().length} tracked stock items across ${Data.locations().length} locations`,
      actions: `<div class="btn-group">
          <button class="${view === 'table' ? 'on' : ''}" data-tab="products.view" data-tab-value="table">List</button>
          <button class="${view === 'grid' ? 'on' : ''}" data-tab="products.view" data-tab-value="grid">Grid</button></div>
        <button class="btn" data-act="product.import">Import</button>
        <button class="btn primary" data-act="product.new">${icon('plus', 15, 2.2)} New product</button>`
    })}
    ${tabs(FILTERS.map(x => ({ id: x.id, label: x.label })), filter, 'products.filter')}
    <div class="row" style="margin-bottom:12px;flex-wrap:wrap">
      <div class="search" style="max-width:320px">${icon('search', 15, 2)}
        <input type="search" placeholder="Name, SKU or barcode…" value="${esc(S.query['products'] || '')}" data-search="products"></div>
      <div class="wrap">${Data.collections().map(c =>
        `<button class="btn sm ghost" data-act="product.filterCollection" data-collection="${c.id}">${esc(c.name)}</button>`).join('')}</div>
    </div>
    ${view === 'grid' ? grid(rows) : `<div class="card">${DataTable({
      entity: 'products', columns: LIST_COLUMNS, rows, rowGo: 'products',
      empty: empty('No products match', 'Try another tab or clear the search.')
    })}</div>`}`;
  },

  detail(id, { S }) {
    const p = Data.product(id);
    if (!p) return empty('Product not found');
    const items = itemsFor(p);
    const active = S.tab['products.tab'] || 'general';
    const free = availableOnDay(p.id, new Date());
    const bookings = Data.orders().filter(o => Lifecycle.state(o.status).holdsStock && o.lines.some(l => l.productId === p.id));
    const revenue = sum(Data.orders().filter(o => !['canceled', 'concept'].includes(o.status)),
      o => sum(o.lines.filter(l => l.productId === p.id), l => lineTotal(l, o)));

    return `
    <div class="row" style="margin-bottom:12px"><button class="btn ghost sm" data-go="products">← Products</button></div>
    <div class="order-hero"><div class="spread" style="flex-wrap:wrap">
      <div class="row" style="align-items:flex-start">
        <div class="thumb" style="width:52px;height:52px;font-size:24px">${p.icon}</div>
        <div><h1 class="page-title">${esc(p.name)}</h1>
          <div class="muted" style="font-size:13px"><span class="mono">${esc(p.sku)}</span> · ${esc(p.type)} · ${esc(p.track)} · ${esc(Data.location(p.location).name)}</div>
          <div class="wrap" style="margin-top:6px">
            ${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
            ${p.allowShortage ? chip(`Shortage allowed up to ${p.shortageLimit}`, 'warn', false) : ''}
            ${p.buffer ? chip(`${p.buffer}-day buffer`, 'plain', false) : ''}
            ${chip(p.online ? 'On the store' : 'Hidden online', p.online ? 'good' : 'plain', false)}
          </div></div>
      </div>
      <div class="wrap" style="justify-content:flex-end">
        <button class="btn" data-act="product.labels" data-product="${p.id}">${icon('print', 15, 2)} Print labels</button>
        <button class="btn" data-act="product.downtime" data-product="${p.id}">Schedule downtime</button>
        <button class="btn primary" data-act="order.new" data-product="${p.id}">${icon('plus', 15, 2.2)} Rent it out</button>
      </div>
    </div></div>
    <div class="tiles" style="margin-bottom:16px">
      ${tile('Owned', p.type === 'service' ? '—' : p.stock, p.track === 'trackable' ? `${items.length} tracked items` : 'bulk tracked')}
      ${tile('Free today', p.type === 'service' ? 'n/a' : free, free <= 0 ? 'fully booked' : 'bookable right now', free <= 0 ? 'alert' : '')}
      ${tile('On open orders', bookings.length, 'reserved or out')}
      ${tile('Revenue booked', money0(revenue), 'lifetime, this product')}
    </div>
    ${tabs(PRODUCT_TABS.map(t => ({ id: t.id, label: t.label, count: t.count ? t.count(p) : undefined })), active, 'products.tab')}
    ${(PRODUCT_TABS.find(t => t.id === active) || PRODUCT_TABS[0]).render(p, { items, bookings })}`;
  },

  actions: {
    'product.new': ({ go }) => {
      const name = prompt('Product name');
      if (!name) return;
      const p = Store.insert('products', {
        id: uid('p'), sku: 'NEW-' + pad(Data.products().length + 1, 3), name, type: 'rental', track: 'bulk',
        icon: '📦', collection: null, price: 50, period: 'day', priceType: 'flat', structure: null,
        deposit: 0, stock: 1, buffer: 0, allowShortage: false, shortageLimit: 0, tags: [],
        location: 'loc_pdx', desc: '', online: true, taxProfile: 'tp_std', variations: []
      });
      toast(`${name} added`);
      go('products', p.id);
    },
    'product.save': ({ render }) => { Store.changed('products'); toast('Product saved'); render(); },
    'product.import': () => toast('Import wizard — map your CSV columns to Booqable fields'),
    'product.filterCollection': ({ data, render }) => {
      toast(`Filtered to ${Data.collections().find(c => c.id === data.collection).name}`);
      render();
    },
    'product.addStock': ({ data, render }) => {
      const p = Data.product(data.product);
      const n = itemsFor(p).length + 1;
      Store.insert('stockItems', {
        id: uid('si'), productId: p.id, identifier: `${p.sku}-${pad(n, 3)}`,
        barcode: 'BQ' + String(Math.abs(hashCode(p.sku + n))).slice(0, 9),
        status: 'in-stock', condition: 'good', location: p.location, note: ''
      });
      p.stock++;
      Store.changed('products');
      toast('Stock item added'); render();
    },
    'product.toggleCondition': ({ data, render }) => {
      const si = Data.stockItems().find(x => x.id === data.stock);
      si.condition = si.condition === 'maintenance' ? 'good' : 'maintenance';
      if (si.condition === 'good') si.note = '';
      Store.changed('stockItems');
      toast(si.condition === 'maintenance' ? 'Sent to the bench — it is out of availability now' : 'Back in service');
      render();
    },
    'product.downtime': ({ data, render }) => {
      const p = Data.product(data.product);
      const reason = prompt('Why is it unavailable?', 'Maintenance');
      if (!reason) return;
      const days = +prompt('For how many days from today?', '3') || 1;
      Store.insert('downtime', { id: uid('dt'), productId: p.id, qty: 1,
        from: new Date().toISOString(), to: addDays(new Date(), days).toISOString(), reason });
      toast(`${days} day(s) of downtime scheduled`); render();
    },
    'product.removeDowntime': ({ data, render }) => {
      Store.remove('downtime', data.downtime); toast('Downtime removed'); render();
    },
    'product.labels': ({ data }) => {
      const p = Data.product(data.product);
      const items = itemsFor(p);
      Modal.open({
        title: 'Print labels', sub: `${p.name} · ${items.length} items`, size: 'wide',
        body: `<div class="pgrid">${items.map(si => `<div class="card" style="padding:12px;text-align:center">
          <div style="font-weight:600;font-size:12px">${esc(p.name)}</div>
          <div class="mono" style="font-size:11px;color:var(--text-3)">${esc(p.sku)}</div>
          <div style="display:flex;justify-content:center;margin:9px 0">${barcode(si.barcode)}</div>
          <div class="mono" style="font-size:11px;font-weight:600">${esc(si.identifier)}</div>
          <div class="mono" style="font-size:10px;color:var(--text-3)">${esc(si.barcode)}</div></div>`).join('')}</div>`,
        foot: '<button class="btn" data-close-modal>Close</button><button class="btn primary" data-act="document.print">Print sheet</button>'
      });
    }
  }
});

function grid(rows) {
  return `<div class="pgrid">${rows.map(p => {
    const a = availableOnDay(p.id, new Date());
    return `<div class="pcard" data-go="products" data-param="${p.id}">
      <div class="img">${p.icon}</div>
      <div class="b"><div class="nm trunc">${esc(p.name)}</div>
        <div class="mono dim" style="font-size:11px">${esc(p.sku)}</div>
        <div class="spread" style="margin-top:7px">
          <span class="num" style="font-weight:600">${money(p.price)}<span class="dim" style="font-weight:400;font-size:11px">/${p.period}</span></span>
          ${p.type === 'rental' ? chip(`${a} free`, a <= 0 ? 'crit' : a <= p.stock * .25 ? 'warn' : 'good', false) : chip(p.type, 'plain', false)}
        </div></div></div>`;
  }).join('')}</div>`;
}

function generalTab(p) {
  const entity = Registry.getEntity('products');
  const core = entity.fields.filter(f => f.group === 'core' && f.form !== false).map(f => f.key);
  return card({ body: `
    ${Form({ entity: 'products', fields: core, record: p, scope: `product:${p.id}` })}
    ${p.bundle ? `<div style="margin-top:16px"><div class="eyebrow" style="margin-bottom:7px">Bundle contents</div>
      ${p.bundle.map(bid => { const b = Data.product(bid);
        return `<div class="checkline"><span class="thumb" style="width:28px;height:28px;font-size:14px">${b.icon}</span>
          <div class="grow"><div style="font-weight:500">${esc(b.name)}</div><div class="mono dim" style="font-size:11px">${esc(b.sku)}</div></div>
          <span class="dim">reserves 1 unit</span></div>`; }).join('')}</div>` : ''}
    ${p.variations.length ? `<div style="margin-top:16px"><div class="eyebrow" style="margin-bottom:7px">Variations</div>
      ${p.variations.map(v => `<div class="checkline"><div class="grow" style="font-weight:500">${esc(v.name)}</div>
        <span class="num dim">${v.stock} in stock</span></div>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:16px"><button class="btn primary" data-act="product.save">Save changes</button></div>` });
}

function pricingTab(p) {
  const st = Data.pricingStructures().find(s => s.id === p.structure);
  const rows = st ? st.rows : [{ label: '1 day', mult: 1 }, { label: '3 days', mult: 3 }, { label: 'Week (7)', mult: 7 }];
  return `<div class="cols c2">
    ${card({ title: 'Price', body: `
      ${Form({ entity: 'products', fields: ['price', 'period', 'priceType', 'deposit', 'taxProfile'], record: p, scope: `product:${p.id}` })}
      <div class="row" style="margin-top:14px"><button class="btn primary" data-act="product.save">Save changes</button></div>` })}
    <div class="card"><div class="card-head"><h3>What a rental actually costs</h3>
      <span class="eyebrow">${esc(st ? st.name : 'flat rate')}</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Duration</th><th class="r">Multiplier</th><th class="r">Charge</th><th class="r">Per day</th></tr></thead>
      <tbody>${rows.map(r => {
        const days = parseInt(r.label) || (/Week/i.test(r.label) ? 7 : /Month/i.test(r.label) ? 30 : 1);
        return `<tr class="norow"><td>${esc(r.label)}</td><td class="r num">×${r.mult}</td>
          <td class="r num" style="font-weight:600">${money(p.price * r.mult)}</td>
          <td class="r num dim">${money(p.price * r.mult / days)}</td></tr>`;
      }).join('')}</tbody></table></div>
      <div class="card-body" style="border-top:1px solid var(--line)"><div class="dim" style="font-size:12px">
        Tiered pricing is how rental businesses stay competitive on long bookings without giving away the short ones. A 7-day hire at ×3.5 earns half the daily rate but ties up the unit once, not seven times.</div></div>
    </div></div>`;
}

function inventoryTab(p, { items }) {
  if (p.track === 'bulk') return card({ body: `
    ${banner('info', '<b>Bulk tracking.</b> Booqable counts how many you own, not which one goes where. Switch to trackable if you need serial numbers, per-unit history or barcodes on each item.')}
    <div style="margin-top:14px">${Form({ entity: 'products', fields: ['stock', 'track'], record: p, scope: `product:${p.id}` })}</div>
    <div class="row" style="margin-top:14px"><button class="btn primary" data-act="product.save">Save changes</button></div>` });

  return `<div class="card">
    <div class="card-head"><h3>Stock items</h3><div class="wrap">
      <button class="btn sm" data-act="product.addStock" data-product="${p.id}">${icon('plus', 13, 2.4)} Add item</button>
      <button class="btn sm" data-act="product.labels" data-product="${p.id}">${icon('print', 13, 2)} Print labels</button></div></div>
    ${DataTable({
      entity: 'stockItems',
      columns: ['identifier',
        { key: 'barcode', label: 'Barcode', type: 'custom',
          render: si => `<div class="mono" style="font-size:11px">${esc(si.barcode)}</div>${barcode(si.barcode)}` },
        { key: 'status', label: 'Status', type: 'custom', render: si => {
          const onOrder = Data.orders().find(o => o.lines.some(l => l.stockItemIds.includes(si.id)));
          return onOrder
            ? `<span class="chip started"><span class="dot"></span>Out on <a href="#/orders/${onOrder.id}" data-go="orders" data-param="${onOrder.id}">#${onOrder.number}</a></span>`
            : chip('In stock', 'good');
        } },
        'condition', 'location', 'note',
        { key: 'act', label: '', align: 'right', type: 'custom',
          render: si => `<button class="btn sm" data-act="product.toggleCondition" data-stock="${si.id}">${
            si.condition === 'maintenance' ? 'Mark good' : 'Send to repair'}</button>` }],
      rows: items, empty: empty('No stock items yet')
    })}</div>`;
}

function availabilityTab(p, { bookings }) {
  const days = [...Array(21)].map((_, i) => addDays(new Date(), i - 3));
  return `<div class="stack">
    ${card({ title: 'Availability rules', body: `
      ${Form({ entity: 'products', fields: ['buffer', 'shortageLimit'], record: p, scope: `product:${p.id}` })}
      <div style="margin-top:10px">${Form({ entity: 'products', fields: ['allowShortage'], record: p, scope: `product:${p.id}`, layout: '' })}</div>
      <div class="row" style="margin-top:14px"><button class="btn primary" data-act="product.save">Save changes</button></div>` })}
    ${card({ title: 'Next three weeks', head: '<span class="eyebrow">units free per day</span>', body: `
      <div class="avail" style="border:0"><table><thead><tr>
        ${days.map(d => `<th>${d.toLocaleDateString('en-US', { weekday: 'narrow' })}<div class="num" style="font-weight:400">${d.getDate()}</div></th>`).join('')}
      </tr></thead><tbody><tr>
        ${days.map(d => { const a = availableOnDay(p.id, d);
          return `<td><div class="cellv ${utilisationTone(a, p.stock)}" title="${a} free on ${d.toDateString()}">${a}</div></td>`; }).join('')}
      </tr></tbody></table></div>` })}
    <div class="card"><div class="card-head"><h3>Scheduled downtime</h3>
      <button class="btn sm" data-act="product.downtime" data-product="${p.id}">${icon('plus', 13, 2.4)} Add</button></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>From</th><th>To</th><th class="r">Units</th><th>Reason</th><th class="r"></th></tr></thead>
      <tbody>${Data.downtime().filter(d => d.productId === p.id).map(d => `<tr class="norow">
        <td class="num" style="font-size:12.5px">${fmtDY(d.from)}</td><td class="num" style="font-size:12.5px">${fmtDY(d.to)}</td>
        <td class="r num">${d.qty}</td><td>${esc(d.reason)}</td>
        <td class="r"><button class="btn sm ghost" data-act="product.removeDowntime" data-downtime="${d.id}">Remove</button></td></tr>`).join('')
        || `<tr class="norow"><td colspan="5">${empty('No downtime scheduled')}</td></tr>`}</tbody></table></div></div>
    <div class="card"><div class="card-head"><h3>On open orders</h3></div>
      ${DataTable({
        entity: 'orders', columns: ['number', 'customerId', 'status', 'period',
          { key: 'qty', label: 'Qty', align: 'right', type: 'custom',
            render: o => `<span class="num">${sum(o.lines.filter(l => l.productId === p.id), l => l.qty)}</span>` }],
        rows: bookings, rowGo: 'orders', empty: empty('Not on any open order')
      })}</div>
  </div>`;
}

function onlineTab(p) {
  return card({ body: `
    ${Form({ entity: 'products', fields: ['online'], record: p, scope: `product:${p.id}`, layout: '' })}
    <div class="switch-row"><button class="switch on"></button>
      <div><div class="t">Show live availability</div><div class="d">The product page displays a real-time calendar of free dates.</div></div></div>
    <div class="switch-row"><button class="switch ${p.price ? 'on' : ''}"></button>
      <div><div class="t">Show price</div><div class="d">Turn off to force a quote request instead of a self-service booking.</div></div></div>
    <div class="grid2" style="margin-top:16px">
      <div class="field"><label>Store URL</label><input value="${esc(Data.company().site)}/rent/${esc(p.sku.toLowerCase())}" readonly></div>
      <div class="field"><label>SEO title</label><input value="${esc(p.name)} rental — ${esc(Data.company().name)}"></div>
    </div>
    <div class="field" style="margin-top:14px"><label>SEO description</label><textarea>${esc(p.desc)}</textarea></div>` });
}

function notesTab(p) {
  const notes = notesFor(p);
  return card({
    title: 'Notes',
    head: `<button class="btn sm" data-act="note.add" data-target="product" data-target-id="${p.id}">${icon('plus', 13, 2.4)} Add note</button>`,
    body: notes.length ? notes.map(noteCard).join('')
      : '<div class="dim" style="font-size:13px">No notes. Use these to flag quirks the whole team should know about.</div>'
  });
}

export function barcode(code) {
  let h = Math.abs(hashCode(code));
  const bars = [...Array(26)].map(() => { const w = (h % 3) + 1; h = Math.floor(h / 3) + ((h % 7) * 13); return w; });
  return `<div class="barcode" style="height:20px;margin-top:3px">${
    bars.map((w, i) => `<i style="width:${w}px;height:${i % 4 === 0 ? 20 : 16}px;opacity:${i % 2 ? 0.15 : 1}"></i>`).join('')}</div>`;
}

Registry.hook('field-input', ({ scope, key, value }) => {
  if (!scope?.startsWith('product:')) return;
  const p = Data.product(scope.slice(8));
  if (!p) return;
  const numeric = ['price', 'deposit', 'stock', 'buffer', 'shortageLimit'];
  setValue(p, key, numeric.includes(key) ? (+value || 0)
    : key === 'tags' && typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean)
    : value);
  Store.changed('products');
  if (typeof value === 'boolean') render();
});
void orderTotals; void availableQty; void chargeUnits;
