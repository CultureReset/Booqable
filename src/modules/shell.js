/* Cross-cutting actions that belong to the chrome rather than to any
   one screen. Registered like everything else. */

import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { toast } from '../core/ui.js';
import { toCSV, downloadCSV, resolveFields } from '../core/view.js';

Registry.actions({
  'shell.menu': ({ S, render }) => { S.sidebarOpen = !S.sidebarOpen; render(); },

  'shell.theme': () => {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : current === 'light' ? null : 'dark';
    if (next) root.setAttribute('data-theme', next); else root.removeAttribute('data-theme');
    toast(next ? `${next[0].toUpperCase() + next.slice(1)} theme` : 'Following your system theme');
  },

  'shell.location': ({ el }) => toast('Switched location — lists now filter to ' + el.selectedOptions?.[0]?.text),

  /* One export handler for every entity: the columns come from the same
     schema the table uses, so exports can never drift from the UI. */
  'export.csv': ({ data }) => {
    const entity = Registry.getEntity(data.entity);
    if (!entity) return toast(`Nothing to export for "${data.entity}"`, 'bad');
    const rows = Store.all(entity.id);
    const columns = entity.fields.filter(f => f.export !== false).map(f => f.key);
    const csv = toCSV(resolveFields(columns, entity.id), rows, entity.id);
    const ok = downloadCSV(`${entity.id}.csv`, csv);
    toast(ok ? `${rows.length} ${entity.plural.toLowerCase()} exported` : 'Export blocked by the browser', ok ? 'ok' : 'bad');
  }
});

/* Global search resolves against whatever entities are registered,
   in a declared order of specificity. */
const RESOLVERS = [
  { id: 'barcode', find: q => Data.stockItems().find(s => [s.barcode, s.identifier].some(v => v.toLowerCase() === q)),
    go: (hit, go) => go('products', hit.productId) },
  { id: 'order', find: q => Data.orders().find(o => String(o.number) === q.replace('#', '')),
    go: (hit, go) => go('orders', hit.id) },
  { id: 'customer', find: q => Data.customers().find(c => c.name.toLowerCase().includes(q)),
    go: (hit, go) => go('customers', hit.id) },
  { id: 'product', find: q => Data.products().find(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase() === q),
    go: (hit, go) => go('products', hit.id) }
];

Registry.hook('global-search', ({ query, go, S }) => {
  const q = query.trim().toLowerCase();
  if (!q) return;
  for (const r of RESOLVERS) {
    const hit = r.find(q);
    if (hit) return r.go(hit, go);
  }
  S.query.orders = query.trim();
  go('orders');
});

/* Select-all on a list feeds the shared selection set. */
Registry.hook('select-all', ({ checked, S }) => {
  Store.all('orders').forEach(o => checked ? S.selection.add(o.id) : S.selection.delete(o.id));
});
