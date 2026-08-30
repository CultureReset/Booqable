/* Booqable REST adapter.

   Same interface as MemoryAdapter, so `Store.init(RestAdapter({...}))`
   swaps the whole application onto a live account without any screen
   changing. It keeps a local cache because the UI is synchronous;
   prime() fills the cache before first render.

   Resource names follow Booqable API v1. The field mapping lives here
   and nowhere else — screens only ever see the internal shape. */

const RESOURCES = {
  orders:      { path: 'orders',         include: 'customer,lines,plannings' },
  products:    { path: 'product_groups', include: 'products' },
  stockItems:  { path: 'items' },
  customers:   { path: 'customers' },
  documents:   { path: 'documents' },
  payments:    { path: 'payments' },
  locations:   { path: 'locations' },
  taxRates:    { path: 'tax_rates' },
  taxProfiles: { path: 'tax_categories' },
  collections: { path: 'collections' },
  coupons:     { path: 'coupons' },
  users:       { path: 'employees' },
  notes:       { path: 'notes' }
};

const cents = n => Math.round((n || 0) * 100);
const fromCents = n => (n || 0) / 100;

/* Translation between Booqable's wire shape and the shape screens use.
   Adding a field means one line in each direction, not a rewrite. */
const MAP = {
  orders: {
    in: o => ({
      id: o.id, number: o.number, status: o.status, customerId: o.customer_id,
      startsAt: o.starts_at, stopsAt: o.stops_at, locationId: o.location_id,
      source: o.source || 'Back office', deposit: fromCents(o.deposit_in_cents),
      couponId: o.coupon_id || null, tags: o.tag_list || [], fields: o.properties || {},
      lines: (o.lines || []).map(MAP.lines.in), createdAt: o.created_at,
      signature: o.signature_name || null, signedAt: o.signed_at || null
    }),
    out: o => ({
      status: o.status, customer_id: o.customerId, starts_at: o.startsAt,
      stops_at: o.stopsAt, location_id: o.locationId,
      deposit_in_cents: cents(o.deposit), coupon_id: o.couponId,
      tag_list: o.tags, properties: o.fields
    })
  },
  lines: {
    in: l => ({
      id: l.id, kind: l.item_id ? 'product' : 'custom', productId: l.item_id,
      title: l.title, sku: l.sku || '—', qty: l.quantity,
      priceEach: fromCents(l.price_each_in_cents), taxProfile: l.tax_category_id,
      pickedQty: l.started_quantity || 0, returnedQty: l.stopped_quantity || 0,
      stockItemIds: l.item_ids || []
    }),
    out: l => ({
      item_id: l.productId, title: l.title, quantity: l.qty,
      price_each_in_cents: cents(l.priceEach), tax_category_id: l.taxProfile
    })
  },
  products: {
    in: p => ({
      id: p.id, sku: p.sku, name: p.name, type: p.product_type || 'rental',
      track: p.trackable ? 'trackable' : 'bulk', icon: '📦',
      collection: p.collection_id, price: fromCents(p.base_price_in_cents),
      period: p.price_period || 'day', priceType: p.price_type || 'flat',
      structure: p.price_structure_id, deposit: fromCents(p.deposit_in_cents),
      stock: p.quantity, buffer: p.lead_time_days || 0,
      allowShortage: !!p.allow_shortage, shortageLimit: p.shortage_limit || 0,
      tags: p.tag_list || [], location: p.location_id, desc: p.description,
      online: !!p.show_in_store, taxProfile: p.tax_category_id, variations: []
    }),
    out: p => ({
      name: p.name, sku: p.sku, base_price_in_cents: cents(p.price),
      trackable: p.track === 'trackable', quantity: p.stock,
      allow_shortage: p.allowShortage, shortage_limit: p.shortageLimit,
      description: p.desc, show_in_store: p.online, tag_list: p.tags
    })
  },
  customers: {
    in: c => ({
      id: c.id, number: c.number, kind: c.company ? 'Company' : 'Individual',
      name: c.name, contact: c.contact_name || c.name, email: c.email, phone: c.phone,
      address: c.properties?.address_line1 || '', city: c.properties?.city || '',
      zip: c.properties?.zipcode || '', country: c.properties?.country || '',
      tags: c.tag_list || [], discount: c.discount_percentage || 0,
      taxProfile: c.tax_category_id, since: c.created_at, fields: c.properties || {}
    }),
    out: c => ({
      name: c.name, email: c.email, phone: c.phone,
      discount_percentage: c.discount, tax_category_id: c.taxProfile,
      tag_list: c.tags, properties: c.fields
    })
  }
};
const identity = { in: x => x, out: x => x };
const mapper = entity => MAP[entity] || identity;

export function RestAdapter({ baseUrl = 'https://api.booqable.com/api/1', token, company, fetchImpl = globalThis.fetch } = {}) {
  const cache = {};
  const config = {};

  const url = (entity, id) => {
    const r = RESOURCES[entity];
    if (!r) throw new Error(`No Booqable resource mapped for "${entity}"`);
    return `${baseUrl}/${r.path}${id ? '/' + id : ''}${r.include ? '?include=' + r.include : ''}`;
  };
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  async function call(method, entity, id, body) {
    const res = await fetchImpl(url(entity, id), {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`Booqable ${method} ${entity} failed: ${res.status}`);
    return res.json();
  }

  return {
    name: 'booqable-rest',
    company,
    collections: () => Object.keys(RESOURCES),

    /* Fill the cache before the first render. */
    async prime(entities = Object.keys(RESOURCES)) {
      for (const e of entities) {
        const json = await call('GET', e);
        const rows = json[RESOURCES[e].path] || json.data || [];
        cache[e] = rows.map(mapper(e).in);
      }
      return this;
    },

    all(entity) { return cache[entity] || (cache[entity] = []); },
    get(entity, id) { return this.all(entity).find(r => r.id === id) || null; },

    insert(entity, record) {
      this.all(entity).unshift(record);
      call('POST', entity, null, { [entity.replace(/s$/, '')]: mapper(entity).out(record) }).catch(reportOffline);
      return record;
    },
    update(entity, id, patch) {
      const r = this.get(entity, id);
      if (r) Object.assign(r, patch);
      call('PUT', entity, id, { [entity.replace(/s$/, '')]: mapper(entity).out(r) }).catch(reportOffline);
      return r;
    },
    remove(entity, id) {
      const list = this.all(entity);
      const i = list.findIndex(r => r.id === id);
      if (i > -1) list.splice(i, 1);
      call('DELETE', entity, id).catch(reportOffline);
    },

    config(key) { return key === undefined ? config : config[key]; },
    setConfig(key, value) { config[key] = value; }
  };
}

/* Writes are optimistic; a failure is surfaced, not swallowed. */
let onOffline = err => console.warn('[booqable] write failed, kept locally:', err.message);
export function onWriteError(fn) { onOffline = fn; }
const reportOffline = err => onOffline(err);
