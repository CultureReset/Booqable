/* A thin entity store over a swappable adapter.

   Every screen reads through Store, never from a global blob, so the
   same UI runs against the in-memory seed or a live Booqable REST
   account by handing init() a different adapter. */

let adapter = null;
const listeners = new Set();

export const Store = {
  init(a) { adapter = a; return Store; },
  adapter: () => adapter,
  adapterName: () => adapter?.name || 'none',

  /* --- reads --- */
  all(entity) { return adapter.all(entity); },
  get(entity, id) { return adapter.get(entity, id); },
  find(entity, pred) { return adapter.all(entity).find(pred); },
  where(entity, pred) { return adapter.all(entity).filter(pred); },
  count(entity, pred) { return pred ? Store.where(entity, pred).length : adapter.all(entity).length; },
  config(key) { return adapter.config(key); },

  /* --- writes: every mutation notifies once, so views never poll --- */
  insert(entity, record) { const r = adapter.insert(entity, record); Store.changed(entity); return r; },
  update(entity, id, patch) { const r = adapter.update(entity, id, patch); Store.changed(entity); return r; },
  remove(entity, id) { adapter.remove(entity, id); Store.changed(entity); },
  setConfig(key, value) { adapter.setConfig(key, value); Store.changed('config'); },

  /* mutate an object in place then announce it — used where a nested
     structure (order lines, stock items) is easier to edit directly */
  touch(entity, fn) { const r = fn && fn(); Store.changed(entity); return r; },

  changed(entity) { listeners.forEach(fn => fn(entity)); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};

/* Convenience readers used across modules. They are one-liners on purpose:
   modules should express intent, not repeat filter predicates. */
export const Data = {
  orders: () => Store.all('orders'),
  order: id => Store.get('orders', id),
  products: () => Store.all('products'),
  product: id => Store.get('products', id),
  customers: () => Store.all('customers'),
  customer: id => Store.get('customers', id),
  documents: () => Store.all('documents'),
  document: id => Store.get('documents', id),
  payments: () => Store.all('payments'),
  stockItems: () => Store.all('stockItems'),
  locations: () => Store.all('locations'),
  location: id => Store.get('locations', id),
  downtime: () => Store.all('downtime'),
  coupons: () => Store.all('coupons'),
  taxRates: () => Store.all('taxRates'),
  taxProfiles: () => Store.all('taxProfiles'),
  collections: () => Store.all('collections'),
  users: () => Store.all('users'),
  me: () => Store.all('users').find(u => u.me),
  notes: () => Store.all('notes'),
  activity: () => Store.all('activity'),
  pricingStructures: () => Store.all('pricingStructures'),
  customFields: () => Store.all('customFields'),
  emailTemplates: () => Store.all('emailTemplates'),
  providers: () => Store.all('providers'),
  apiKeys: () => Store.all('apiKeys'),
  apps: () => Store.all('apps'),
  storePages: () => Store.all('storePages'),
  tagList: () => Store.all('tagList'),
  company: () => Store.config('company'),
  labels: () => Store.config('labels'),
  orderDefaults: () => Store.config('orderDefaults')
};
