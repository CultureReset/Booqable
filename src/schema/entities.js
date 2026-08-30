/* Entity schemas.

   One description of each field, consumed by tables, forms, detail
   sidebars, document templates, CSV exports and the Blueprint. Adding a
   field to an entity here makes it appear everywhere that reads the
   schema — there is no second place to update. */

import { Registry } from '../core/registry.js';
import { Data } from '../core/store.js';
import { esc, titleCase } from '../core/util.js';
import { money, fmtD, fmtT, fmtDY, fmtDT } from '../core/fields.js';
import { Lifecycle, isLate, isLateReturn, totalItems, pickedItems, returnedItems } from './lifecycle.js';
import { orderTotals } from './pricing.js';
import { availableOnDay, orderShortages } from './availability.js';

const G = {
  order:    [{ id: 'core', label: null }, { id: 'period', label: 'Rental period' }, { id: 'meta', label: 'Classification' }],
  product:  [{ id: 'core', label: null }, { id: 'pricing', label: 'Pricing' }, { id: 'stock', label: 'Availability' }, { id: 'store', label: 'Online store' }],
  customer: [{ id: 'core', label: null }, { id: 'address', label: 'Address' }, { id: 'terms', label: 'Commercial terms' }]
};

export function registerEntities() {
  /* ---------------------------------------------------------- ORDER */
  Registry.entity({
    id: 'orders', label: 'Order', plural: 'Orders', module: 'orders', groups: G.order,
    fields: [
      { key: 'number', label: 'Order', type: 'custom', group: 'core', form: false, width: '110px',
        render: o => `<span class="mono" style="font-weight:600">#${o.number}</span>${
          isLate(o) ? `<div><span class="chip crit" style="margin-top:3px"><span class="dot"></span>${isLateReturn(o) ? 'Overdue return' : 'Late pickup'}</span></div>` : ''}${
          Lifecycle.state(o.status).holdsStock && orderShortages(o).length ? '<div><span class="chip warn" style="margin-top:3px"><span class="dot"></span>Shortage</span></div>' : ''}` },
      { key: 'customerId', label: 'Customer', type: 'relation', entity: 'customers', module: 'customers', group: 'core',
        display: c => c.name, required: true },
      { key: 'status', label: 'Status', type: 'chip', group: 'core', form: false,
        tone: v => Lifecycle.tone(v), chipLabel: v => Lifecycle.label(v) },
      { key: 'period', label: 'Rental period', type: 'custom', group: 'period', form: false,
        render: o => `<span class="num" style="font-size:12.5px">${fmtD(o.startsAt)} ${fmtT(o.startsAt)}<div class="dim">→ ${fmtD(o.stopsAt)} ${fmtT(o.stopsAt)}</div></span>` },
      { key: 'startsAt', label: 'Starts', type: 'datetime', group: 'period', table: false },
      { key: 'stopsAt', label: 'Stops', type: 'datetime', group: 'period', table: false },
      { key: 'items', label: 'Items', type: 'number', align: 'right', group: 'meta', form: false, compute: totalItems },
      { key: 'locationId', label: 'Location', type: 'relation', entity: 'locations', link: false, group: 'meta', display: l => l.name },
      { key: 'source', label: 'Source', type: 'select', group: 'meta',
        options: ['Back office', 'Online store', 'Mobile POS'] },
      { key: 'tags', label: 'Tags', type: 'tags', group: 'meta' },
      { key: 'deposit', label: 'Security deposit', type: 'money', group: 'meta' },
      { key: 'total', label: 'Total', type: 'custom', align: 'right', form: false,
        render: o => `<span class="num" style="font-weight:600">${money(orderTotals(o).total)}</span>`,
        exportValue: o => orderTotals(o).total.toFixed(2) },
      { key: 'due', label: 'Due', type: 'custom', align: 'right', form: false,
        render: o => { const t = orderTotals(o);
          return `<span class="num" style="font-weight:600;color:${t.due > 0.01 ? 'var(--crit)' : 'var(--good)'}">${t.due > 0.01 ? money(t.due) : 'Paid'}</span>`; } },
      { key: 'createdAt', label: 'Created', type: 'datetime', form: false, table: false },
      { key: 'signature', label: 'Signature', type: 'text', form: false, table: false }
    ]
  });

  /* -------------------------------------------------------- PRODUCT */
  Registry.entity({
    id: 'products', label: 'Product', plural: 'Products', module: 'products', groups: G.product,
    fields: [
      { key: 'name', label: 'Product', type: 'custom', group: 'core', required: true,
        render: p => `<div class="row"><div class="thumb">${p.icon}</div><div>
          <div style="font-weight:600">${esc(p.name)}</div>
          <div class="mono dim" style="font-size:11px">${esc(p.sku)}${p.variations?.length ? ` · ${p.variations.length} variations` : ''}</div></div></div>`,
        renderEdit: (p, v) => `<input data-field-key="name" value="${esc(v)}">` },
      { key: 'sku', label: 'SKU', type: 'mono', group: 'core' },
      { key: 'type', label: 'Type', type: 'select', group: 'core',
        options: ['rental', 'sales', 'service', 'bundle'] },
      { key: 'track', label: 'Tracking', type: 'select', group: 'core',
        options: [{ value: 'bulk', label: 'Bulk — count only' }, { value: 'trackable', label: 'Trackable — per unit' }],
        help: 'Trackable units get identifiers, barcodes and their own history.' },
      { key: 'collection', label: 'Collection', type: 'relation', entity: 'collections', link: false, allowEmpty: true,
        group: 'core', display: c => c.name },
      { key: 'location', label: 'Home location', type: 'relation', entity: 'locations', link: false, group: 'core', display: l => l.name },
      { key: 'tags', label: 'Tags', type: 'tags', group: 'core' },
      { key: 'desc', label: 'Description on documents & store', type: 'longtext', group: 'core' },

      { key: 'price', label: 'Base price', type: 'money', group: 'pricing', align: 'right' },
      { key: 'period', label: 'Charged per', type: 'select', group: 'pricing', options: ['day', 'week', 'order', 'once'] },
      { key: 'priceType', label: 'Pricing type', type: 'select', group: 'pricing',
        options: () => Registry.pricingStrategyIds().map(id => ({
          value: id,
          label: { flat: 'Flat — price × days', structure: 'Pricing structure — tiered', fixed: 'Fixed — charged once' }[id] || titleCase(id)
        })) },
      { key: 'deposit', label: 'Security deposit', type: 'money', group: 'pricing', align: 'right' },
      { key: 'taxProfile', label: 'Tax profile', type: 'relation', entity: 'taxProfiles', link: false, group: 'pricing', display: t => t.name },

      { key: 'stock', label: 'Owned', type: 'number', group: 'stock', align: 'right' },
      { key: 'buffer', label: 'Buffer time (days)', type: 'number', group: 'stock',
        help: 'Blocks the unit before and after every rental for cleaning, charging or servicing.' },
      { key: 'allowShortage', label: 'Allow shortages', type: 'bool', style: 'switch', group: 'stock',
        help: 'Let staff overbook when you can sub-rent or borrow in time.' },
      { key: 'shortageLimit', label: 'Shortage limit', type: 'number', group: 'stock',
        help: 'How far past your own stock a booking may go before it is blocked.' },
      { key: 'free', label: 'Free today', type: 'custom', align: 'right', form: false,
        render: p => p.type === 'service' ? '<span class="chip plain">n/a</span>' : (() => {
          const a = availableOnDay(p.id, new Date());
          return `<span class="chip ${a <= 0 ? 'crit' : a <= p.stock * .25 ? 'warn' : 'good'}">${a}</span>`;
        })() },
      { key: 'online', label: 'Show in the online store', type: 'bool', style: 'switch', group: 'store',
        help: 'Customers can find and book this product themselves.' }
    ]
  });

  /* ------------------------------------------------------- CUSTOMER */
  Registry.entity({
    id: 'customers', label: 'Customer', plural: 'Customers', module: 'customers', groups: G.customer,
    fields: [
      { key: 'name', label: 'Customer', type: 'custom', group: 'core', required: true,
        render: c => `<div class="row"><div class="avatar">${esc(c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join(''))}</div>
          <div><div style="font-weight:600">${esc(c.name)}</div><div class="mono dim" style="font-size:11px">${esc(c.number)}</div></div></div>`,
        renderEdit: (c, v) => `<input data-field-key="name" value="${esc(v)}">` },
      { key: 'kind', label: 'Type', type: 'select', group: 'core', options: ['Company', 'Individual'] },
      { key: 'contact', label: 'Primary contact', type: 'text', group: 'core' },
      { key: 'email', label: 'Email', type: 'text', group: 'core' },
      { key: 'phone', label: 'Phone', type: 'text', group: 'core' },
      { key: 'address', label: 'Address', type: 'text', group: 'address' },
      { key: 'city', label: 'City', type: 'text', group: 'address' },
      { key: 'zip', label: 'Postal code', type: 'text', group: 'address' },
      { key: 'country', label: 'Country', type: 'text', group: 'address' },
      { key: 'discount', label: 'Standing discount (%)', type: 'percent', group: 'terms',
        help: 'Applied to every new order before tax.' },
      { key: 'taxProfile', label: 'Tax profile', type: 'relation', entity: 'taxProfiles', link: false, group: 'terms', display: t => t.name },
      { key: 'tags', label: 'Tags', type: 'tags', group: 'terms' },
      { key: 'since', label: 'Since', type: 'date', group: 'terms', form: false },
      { key: 'orderCount', label: 'Orders', type: 'number', align: 'right', form: false,
        compute: c => Data.orders().filter(o => o.customerId === c.id).length },
      { key: 'lifetime', label: 'Lifetime value', type: 'custom', align: 'right', form: false,
        render: c => `<span class="num" style="font-weight:600">${money(lifetimeValue(c))}</span>`,
        exportValue: c => lifetimeValue(c).toFixed(2) },
      { key: 'outstanding', label: 'Outstanding', type: 'custom', align: 'right', form: false,
        render: c => { const d = outstanding(c);
          return `<span class="num" style="color:${d > 0.01 ? 'var(--crit)' : 'var(--text-3)'}">${d > 0.01 ? money(d) : '—'}</span>`; } }
    ]
  });

  /* ------------------------------------------------------- DOCUMENT */
  Registry.entity({
    id: 'documents', label: 'Document', plural: 'Documents', module: 'documents',
    fields: [
      { key: 'number', label: 'Number', type: 'mono', cellStyle: 'font-weight:600' },
      { key: 'type', label: 'Type', type: 'custom',
        render: d => esc(Registry.documentTypeById(d.type)?.label || titleCase(d.type)) },
      { key: 'orderId', label: 'Order', type: 'custom',
        render: d => { const o = Data.order(d.orderId);
          return o ? `<a href="#/orders/${o.id}" class="mono" data-go="orders" data-param="${o.id}" onclick="event.stopPropagation()">#${o.number}</a>` : '—'; } },
      { key: 'customer', label: 'Customer', type: 'custom',
        render: d => { const o = Data.order(d.orderId); const c = o && Data.customer(o.customerId); return esc(c ? c.name : '—'); } },
      { key: 'status', label: 'Status', type: 'chip', dot: false,
        tone: v => DOC_TONE[v] || 'plain', chipLabel: v => v },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'sentTo', label: 'Sent to', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'custom', align: 'right',
        render: d => { const o = Data.order(d.orderId); return o ? `<span class="num" style="font-weight:600">${money(orderTotals(o).total)}</span>` : '—'; } }
    ]
  });

  /* ------------------------------------------------------ STOCK ITEM */
  Registry.entity({
    id: 'stockItems', label: 'Stock item', plural: 'Stock items',
    fields: [
      { key: 'identifier', label: 'Identifier', type: 'mono', cellStyle: 'font-weight:600' },
      { key: 'barcode', label: 'Barcode', type: 'mono' },
      { key: 'condition', label: 'Condition', type: 'chip',
        tone: v => v === 'maintenance' ? 'warn' : 'plain', chipLabel: v => titleCase(v) },
      { key: 'location', label: 'Location', type: 'relation', entity: 'locations', link: false, display: l => l.code },
      { key: 'note', label: 'Note', type: 'text' }
    ]
  });

  /* --------------------------------------------------------- PAYMENT */
  Registry.entity({
    id: 'payments', label: 'Payment', plural: 'Payments',
    fields: [
      { key: 'when', label: 'Date', type: 'datetime' },
      { key: 'kind', label: 'Kind', type: 'text' },
      { key: 'method', label: 'Method', type: 'select',
        options: ['Credit card', 'Cash', 'Bank transfer', 'Check', 'Tap to Pay'] },
      { key: 'status', label: 'Status', type: 'chip', tone: v => PAY_TONE[v] || 'warn', chipLabel: v => v },
      { key: 'amount', label: 'Amount', type: 'money', align: 'right', cellStyle: 'font-weight:600' }
    ]
  });

  /* ------------------------------------------------ SMALL REFERENCE ENTITIES */
  Registry.entity({
    id: 'locations', label: 'Location', plural: 'Locations',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'code', label: 'Code', type: 'mono' },
      { key: 'type', label: 'Type', type: 'select', options: ['Pickup + inventory', 'Inventory only'] },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'items', label: 'Stock items', type: 'number', align: 'right', form: false,
        compute: l => Data.stockItems().filter(si => si.location === l.id).length }
    ]
  });

  Registry.entity({
    id: 'coupons', label: 'Coupon', plural: 'Coupons',
    fields: [
      { key: 'code', label: 'Code', type: 'mono', cellStyle: 'font-weight:600' },
      { key: 'kind', label: 'Type', type: 'select', options: ['Percentage', 'Fixed'] },
      { key: 'value', label: 'Value', type: 'custom', align: 'right',
        render: c => `<span class="num">${c.kind === 'Percentage' ? c.value + '%' : money(c.value)}</span>` },
      { key: 'uses', label: 'Used', type: 'number', align: 'right' },
      { key: 'limit', label: 'Limit', type: 'custom', align: 'right', render: c => `<span class="num">${c.limit || '∞'}</span>` },
      { key: 'active', label: 'Active', type: 'bool' },
      { key: 'note', label: 'Note', type: 'text' }
    ]
  });

  Registry.entity({
    id: 'taxRates', label: 'Tax rate', plural: 'Tax rates',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['Regional', 'Compound', 'Exempt'] },
      { key: 'rate', label: 'Rate', type: 'percent', align: 'right' }
    ]
  });

  Registry.entity({
    id: 'users', label: 'Team member', plural: 'Team',
    fields: [
      { key: 'name', label: 'Name', type: 'custom',
        render: u => `<div class="row"><div class="avatar">${esc(u.name.split(/\s+/).map(w => w[0]).join(''))}</div>
          <span style="font-weight:500">${esc(u.name)}${u.me ? ' <span class="chip plain">you</span>' : ''}</span></div>` },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'role', label: 'Role', type: 'select', options: ['Owner', 'Operator', 'Warehouse', 'Finance'] },
      { key: 'twofa', label: '2FA', type: 'chip', tone: v => v ? 'good' : 'warn', chipLabel: v => v ? 'On' : 'Off' },
      { key: 'last', label: 'Last active', type: 'text' }
    ]
  });

  Registry.entity({
    id: 'customFields', label: 'Custom field', plural: 'Custom fields',
    fields: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'entity', label: 'Applies to', type: 'select', options: ['Order', 'Customer', 'Product'] },
      { key: 'type', label: 'Type', type: 'select', options: ['Text', 'Date', 'Number', 'Yes / No'] },
      { key: 'onDocs', label: 'On documents', type: 'bool' }
    ]
  });
}

const DOC_TONE = {
  Draft: 'plain', Sent: 'info', Accepted: 'good', Signed: 'good',
  Paid: 'good', 'Partially paid': 'warn', Overdue: 'crit', Printed: 'plain'
};
const PAY_TONE = { Paid: 'good', Authorized: 'info', Released: 'plain' };

export const lifetimeValue = c => Data.orders()
  .filter(o => o.customerId === c.id && !['canceled', 'concept'].includes(o.status))
  .reduce((s, o) => s + orderTotals(o).total, 0);

export const outstanding = c => Data.orders()
  .filter(o => o.customerId === c.id && !['canceled', 'concept', 'archived'].includes(o.status))
  .reduce((s, o) => s + Math.max(0, orderTotals(o).due), 0);

export const customerStats = c => {
  const orders = Data.orders().filter(o => o.customerId === c.id);
  return { orders, count: orders.length, spend: lifetimeValue(c), due: outstanding(c) };
};

export { fmtDY, fmtDT, pickedItems, returnedItems };
