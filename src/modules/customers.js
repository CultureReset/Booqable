import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { esc, uid, D, groupBy } from '../core/util.js';
import { pageHead, tile, card, empty, toast, icon, avatar, chip, tabs } from '../core/ui.js';
import { money, money0, fmtDY } from '../core/fields.js';
import { DataTable, Form, FieldList } from '../core/view.js';
import { setValue } from '../core/fields.js';
import { render } from '../core/app.js';
import { customerStats } from '../schema/entities.js';
import { Lifecycle } from '../schema/lifecycle.js';
import { orderTotals } from '../schema/pricing.js';
import { noteCard } from './dashboard.js';

const LIST_COLUMNS = ['name', 'kind', 'email', 'tags', 'orderCount', 'lifetime', 'outstanding'];

const CUSTOMER_TABS = [
  { id: 'orders', label: 'Orders', count: c => customerStats(c).count, render: ordersTab },
  { id: 'documents', label: 'Documents', count: c => docsFor(c).length, render: docsTab },
  { id: 'notes', label: 'Notes', count: c => notesFor(c).length, render: notesTab },
  { id: 'profile', label: 'Profile & fields', render: profileTab }
];

const docsFor = c => Data.documents().filter(d => { const o = Data.order(d.orderId); return o && o.customerId === c.id; });
const notesFor = c => Data.notes().filter(n => n.target === 'customer' && n.targetId === c.id);

Registry.module({
  id: 'customers', label: 'Customers', icon: 'customers', order: 50, group: 'Manage',
  entity: 'customers',

  render({ S }) {
    const q = (S.query['customers'] || '').trim().toLowerCase();
    const rows = Data.customers().filter(c => !q
      || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.number.toLowerCase().includes(q));
    return `
    ${pageHead({
      title: 'Customers',
      sub: `${Data.customers().length} profiles · rental history, standing discounts and custom fields`,
      actions: `<button class="btn" data-act="export.csv" data-entity="customers">Export CSV</button>
                <button class="btn primary" data-act="customer.new">${icon('plus', 15, 2.2)} New customer</button>`
    })}
    <div class="search" style="max-width:340px;margin-bottom:12px">${icon('search', 15, 2)}
      <input type="search" placeholder="Name, email or customer number…" value="${esc(S.query['customers'] || '')}" data-search="customers"></div>
    <div class="card">${DataTable({
      entity: 'customers', columns: LIST_COLUMNS, rows, rowGo: 'customers',
      empty: empty('No customers match')
    })}</div>`;
  },

  detail(id, { S }) {
    const c = Data.customer(id);
    if (!c) return empty('Customer not found');
    const s = customerStats(c);
    const active = S.tab['customers.tab'] || 'orders';
    return `
    <div class="row" style="margin-bottom:12px"><button class="btn ghost sm" data-go="customers">← Customers</button></div>
    <div class="order-hero"><div class="spread" style="flex-wrap:wrap">
      <div class="row" style="align-items:flex-start">
        ${avatar(c.name, 44)}
        <div><h1 class="page-title">${esc(c.name)}</h1>
          <div class="muted" style="font-size:13px"><span class="mono">${esc(c.number)}</span> · ${esc(c.kind)} · customer since ${fmtDY(c.since)}</div>
          <div class="wrap" style="margin-top:6px">
            ${c.discount ? chip(`${c.discount}% standing discount`, 'good', false) : ''}
            ${c.taxProfile === 'tp_exempt' ? chip('Tax exempt', 'plain', false) : ''}
            ${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
          </div></div>
      </div>
      <div class="wrap" style="justify-content:flex-end">
        <button class="btn" data-act="customer.email" data-customer="${c.id}">Email customer</button>
        <button class="btn primary" data-act="order.new" data-customer="${c.id}">${icon('plus', 15, 2.2)} New order</button>
      </div>
    </div></div>
    <div class="tiles" style="margin-bottom:16px">
      ${tile('Orders', s.count, `${s.orders.filter(o => Lifecycle.state(o.status).holdsStock).length} open`)}
      ${tile('Lifetime value', money0(s.spend), 'excludes concepts & cancels')}
      ${tile('Outstanding', money0(s.due), s.due > 0.01 ? 'chase this' : 'all settled', s.due > 0.01 ? 'alert' : '')}
      ${tile('Avg order', s.count ? money0(s.spend / s.count) : '—', 'per booking')}
    </div>
    <div class="cols detail">
      <div>
        ${tabs(CUSTOMER_TABS.map(t => ({ id: t.id, label: t.label, count: t.count ? t.count(c) : undefined })), active, 'customers.tab')}
        ${(CUSTOMER_TABS.find(t => t.id === active) || CUSTOMER_TABS[0]).render(c, s)}
      </div>
      <aside class="card" style="align-self:start">
        <div class="side-block"><div class="lbl">Contact</div>
          <div style="font-size:13px">${esc(c.email)}<div class="dim">${esc(c.phone)}</div>
          <div class="dim" style="margin-top:6px">${esc(c.address)}<br>${esc(c.city)} ${esc(c.zip)}<br>${esc(c.country)}</div></div></div>
        <div class="side-block"><div class="lbl">Custom fields</div>
          ${Object.keys(c.fields).length
            ? FieldList(Object.keys(c.fields).map(k => ({ key: `fields.${k}`, label: k, type: 'text' })), c)
            : '<div class="dim" style="font-size:12.5px">None set.</div>'}</div>
        <div class="side-block"><div class="lbl">Most rented</div>${mostRented(s.orders)}</div>
      </aside>
    </div>`;
  },

  actions: {
    'customer.new': ({ go }) => {
      const name = prompt('Customer name');
      if (!name) return;
      const c = Store.insert('customers', {
        id: uid('c'), number: 'CUST-' + (1046 + Data.customers().length), kind: 'Company',
        name, contact: name, email: name.toLowerCase().replace(/\s+/g, '.') + '@example.com',
        phone: '', address: '', city: '', zip: '', country: Data.company().country,
        tags: [], discount: 0, taxProfile: 'tp_std',
        since: new Date().toISOString().slice(0, 10), fields: {}
      });
      toast(`${name} added`);
      go('customers', c.id);
    },
    'customer.save': ({ render }) => { Store.changed('customers'); toast('Customer saved'); render(); },
    'customer.email': () => toast('Composer opened with your manual email templates')
  }
});

function ordersTab(c, s) {
  return `<div class="card">${DataTable({
    entity: 'orders', columns: ['number', 'status', 'period', 'total', 'due'],
    rows: s.orders.slice().sort((a, b) => D(b.startsAt) - D(a.startsAt)),
    rowGo: 'orders', empty: empty('No orders yet')
  })}</div>`;
}
function docsTab(c) {
  return `<div class="card">${DataTable({
    entity: 'documents', columns: ['number', 'type', 'status', 'date'],
    rows: docsFor(c), rowAct: 'document.preview', rowData: d => ({ doc: d.id }),
    empty: empty('No documents')
  })}</div>`;
}
function notesTab(c) {
  const notes = notesFor(c);
  return card({
    title: 'Notes',
    head: `<button class="btn sm" data-act="note.add" data-target="customer" data-target-id="${c.id}">${icon('plus', 13, 2.4)} Add note</button>`,
    body: notes.length ? notes.map(noteCard).join('') : '<div class="dim">No notes on this customer.</div>'
  });
}
function profileTab(c) {
  const entity = Registry.getEntity('customers');
  const custom = Data.customFields().filter(f => f.entity === 'Customer')
    .map(f => ({ key: `fields.${f.label}`, label: f.label, type: 'text', placeholder: '—' }));
  return card({
    body: `${Form({ entity: 'customers', record: c, scope: `customer:${c.id}`,
      groups: entity.groups,
      fields: entity.fields.filter(f => f.form !== false).map(f => f.key) })}
      <h4 style="margin:18px 0 8px;font-size:13px">Custom fields</h4>
      ${Form({ fields: custom, record: c, scope: `customer:${c.id}` })}
      <div class="row" style="margin-top:16px"><button class="btn primary" data-act="customer.save">Save changes</button></div>`
  });
}
function mostRented(orders) {
  const tally = {};
  orders.forEach(o => o.lines.forEach(l => { if (l.productId) tally[l.productId] = (tally[l.productId] || 0) + l.qty; }));
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return top.length ? top.map(([pid, q]) => {
    const p = Data.product(pid);
    return `<div class="spread" style="font-size:12.5px;padding:2px 0"><span class="trunc">${esc(p.name)}</span><span class="num dim">${q}×</span></div>`;
  }).join('') : '<div class="dim" style="font-size:12.5px">Nothing yet.</div>';
}

Registry.hook('field-input', ({ scope, key, value }) => {
  if (!scope?.startsWith('customer:')) return;
  const c = Data.customer(scope.slice(9));
  if (!c) return;
  setValue(c, key, key === 'discount' ? (+value || 0) : key === 'tags' && typeof value === 'string'
    ? value.split(',').map(s => s.trim()).filter(Boolean) : value);
  Store.changed('customers');
});
void money; void orderTotals; void groupBy; void render;
