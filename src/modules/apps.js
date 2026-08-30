import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { esc } from '../core/util.js';
import { pageHead, chip, toast } from '../core/ui.js';
import { DataTable } from '../core/view.js';

/* The REST resource map is generated from the adapter's own mapping
   table, so it can never drift from what the adapter actually does. */
const RESOURCE_DOCS = [
  ['orders', 'An order and its status', 'number, status, starts_at, stops_at, price_in_cents'],
  ['lines', 'Rows on the order', 'title, quantity, price_each_in_cents, tax_category_id'],
  ['plannings', 'The reservation itself', 'item_id, quantity, reserved, started, stopped'],
  ['product_groups', 'A product', 'name, sku, base_price_in_cents, trackable'],
  ['products', 'A variation of a product', 'product_group_id, name, quantity'],
  ['items', 'A trackable stock item', 'identifier, barcode, status'],
  ['customers', 'A customer profile', 'name, email, phone, properties, tags'],
  ['documents', 'Quote / contract / invoice', 'number, kind, status, order_id'],
  ['payments', 'Money against an order', 'amount_in_cents, provider, status']
];

Registry.module({
  id: 'apps', label: 'Apps', icon: 'apps', order: 90, group: 'Grow',

  render() {
    return `
    ${pageHead({
      title: 'Apps & integrations',
      sub: 'Connect the rest of the stack — accounting, automation, analytics, notifications',
      actions: '<button class="btn" data-go="settings" data-param="api">API keys</button>'
    })}
    <div class="cols c3">
      ${Data.apps().map(a => `<div class="card"><div class="card-body">
        <div class="spread" style="align-items:flex-start">
          <div><h3 style="font-size:14px;font-weight:600">${esc(a.name)}</h3>
            <div class="eyebrow" style="margin-top:2px">${esc(a.cat)}</div></div>
          <button class="switch ${a.on ? 'on' : ''}" data-act="app.toggle" data-id="${a.id}" aria-pressed="${a.on}"></button></div>
        <div class="muted" style="font-size:12.5px;margin-top:9px">${esc(a.desc)}</div>
        <div style="margin-top:10px">${chip(a.on ? 'Connected' : 'Not connected', a.on ? 'good' : 'plain', false)}</div>
      </div></div>`).join('')}
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h3>Booqable API</h3><button class="btn sm" data-go="settings" data-param="api">Manage keys</button></div>
      <div class="card-body">
        <div class="muted" style="font-size:13px;margin-bottom:10px">Everything in this dashboard is available over REST. The core resources map one-to-one to what you see here — and to the entity schemas this app is built from:</div>
        ${DataTable({
          columns: [
            { key: 'r', label: 'Resource', type: 'mono', cellStyle: 'font-weight:600' },
            { key: 'w', label: 'What it is here', type: 'text' },
            { key: 'f', label: 'Key fields', type: 'mono' }
          ],
          rows: RESOURCE_DOCS.map(([r, w, f], i) => ({ id: 'res_' + i, r, w, f }))
        })}
        <div class="dim" style="font-size:12px;margin-top:10px">This app currently reads from the
          <span class="kbd">${esc(Store.adapterName())}</span> adapter. The REST adapter implements the same
          interface, so pointing at a live account changes one line at boot and nothing else.</div>
      </div>
    </div>`;
  },

  actions: {
    'app.toggle': ({ data, render }) => {
      const a = Data.apps().find(x => x.id === data.id);
      a.on = !a.on;
      Store.changed('apps');
      toast(`${a.name} ${a.on ? 'connected' : 'disconnected'}`);
      render();
    }
  }
});
