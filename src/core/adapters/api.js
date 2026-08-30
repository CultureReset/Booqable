/* Adapter for this project's own backend.

   Same interface as MemoryAdapter, so `Store.init(ApiAdapter(...))`
   moves every screen — web and Android — onto Postgres with no other
   change. The UI is synchronous, so the adapter keeps a local cache
   primed by one /api/bootstrap call and writes through optimistically,
   reconciling with whatever the server returns.

   The important difference from MemoryAdapter: the server can say no.
   Reserving may fail because someone else took the last unit a
   millisecond earlier, and that refusal has to reach the user rather
   than being swallowed. onError() is where that goes. */

const ENTITY_PATHS = {
  orders: '/api/orders',
  products: '/api/products',
  customers: '/api/customers'
};

export function ApiAdapter({ baseUrl = '', token = null, fetchImpl = globalThis.fetch, onError } = {}) {
  const cache = {};
  const config = {};
  let authToken = token;

  const report = onError || (err => console.warn('[api]', err.message));

  async function call(method, path, body) {
    const res = await fetchImpl(baseUrl + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let payload = null;
    try { payload = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error(payload?.error || `${method} ${path} failed (${res.status})`);
      err.status = res.status;
      err.detail = payload?.detail;
      throw err;
    }
    return payload;
  }

  const adapter = {
    name: 'postgres-api',
    baseUrl,

    /* ---- auth ---- */
    async signIn(email, password) {
      const out = await call('POST', '/api/auth/signin', { email, password });
      authToken = out.token;
      return out;
    },
    async signOut() {
      try { await call('POST', '/api/auth/signout'); } catch { /* already gone */ }
      authToken = null;
    },
    setToken(t) { authToken = t; },
    token: () => authToken,

    /* ---- prime the cache; the UI reads synchronously afterwards ---- */
    async prime() {
      const b = await call('GET', '/api/bootstrap');
      for (const [k, v] of Object.entries(b)) {
        if (Array.isArray(v)) cache[k] = v;
        else config[k] = v;
      }
      cache.tagList = [...new Set([
        ...(cache.products || []).flatMap(p => p.tags || []),
        ...(cache.customers || []).flatMap(c => c.tags || [])
      ])];
      /* things the demo carries that the API does not model yet */
      cache.providers ||= [];
      cache.apiKeys ||= [];
      cache.apps ||= [];
      cache.storePages ||= [];
      return adapter;
    },
    async refresh() { return adapter.prime(); },

    /* ---- Store interface ---- */
    collections: () => Object.keys(cache),
    all(entity) { return cache[entity] || (cache[entity] = []); },
    get(entity, id) { return adapter.all(entity).find(r => r.id === id) || null; },

    insert(entity, record) {
      adapter.all(entity).unshift(record);
      const path = ENTITY_PATHS[entity];
      if (path) call('POST', path, record).then(saved => {
        if (saved?.id && saved.id !== record.id) Object.assign(record, saved);
      }).catch(report);
      return record;
    },
    update(entity, id, patch) {
      const r = adapter.get(entity, id);
      if (r) Object.assign(r, patch);
      const path = ENTITY_PATHS[entity];
      if (path) call('PATCH', `${path}/${id}`, patch).catch(report);
      return r;
    },
    remove(entity, id) {
      const list = adapter.all(entity);
      const i = list.findIndex(r => r.id === id);
      if (i > -1) list.splice(i, 1);
      const path = ENTITY_PATHS[entity];
      if (path) call('DELETE', `${path}/${id}`).catch(report);
    },

    config(key) { return key === undefined ? config : config[key]; },
    setConfig(key, value) {
      if (typeof value === 'object' && !Array.isArray(value) && config[key]) Object.assign(config[key], value);
      else config[key] = value;
    },

    /* ---- operations the server owns outright ----
       These return a promise and can reject; callers must handle it,
       because "the last camera just went" is a real answer. */
    availability(productId, from, to, ignoreOrder) {
      const q = new URLSearchParams({ product: productId, from, to, ...(ignoreOrder ? { ignoreOrder } : {}) });
      return call('GET', `/api/availability?${q}`).then(r => r.available);
    },
    async reserve(orderId) {
      const order = await call('POST', `/api/orders/${orderId}/reserve`);
      return adapter.absorbOrder(order);
    },
    async pickup(orderId, lines, signature) {
      return adapter.absorbOrder(await call('POST', `/api/orders/${orderId}/pickup`, { lines, signature }));
    },
    async returnItems(orderId, lines, { withhold, note } = {}) {
      return adapter.absorbOrder(await call('POST', `/api/orders/${orderId}/return`, { lines, withhold, note }));
    },
    async setStatus(orderId, action) {
      return adapter.absorbOrder(await call('POST', `/api/orders/${orderId}/status`, { action }));
    },
    async addLine(orderId, line) {
      const out = await call('POST', `/api/orders/${orderId}/lines`, line);
      return adapter.absorbOrder(out.order);
    },
    async removeLine(orderId, lineId) {
      return adapter.absorbOrder(await call('DELETE', `/api/orders/${orderId}/lines/${lineId}`));
    },
    async takePayment(orderId, payment) {
      const out = await call('POST', `/api/orders/${orderId}/payments`, payment);
      if (out.payment) cache.payments.unshift({
        id: out.payment.id, orderId, amount: payment.amount, method: payment.method,
        kind: payment.kind, status: out.payment.status, when: out.payment.paidAt
      });
      return adapter.absorbOrder(out.order);
    },
    async createDocument(orderId, type) {
      const d = await call('POST', `/api/orders/${orderId}/documents`, { type });
      cache.documents.unshift({
        id: d.id, orderId, type: d.docType, number: d.number,
        status: d.status, date: d.issuedAt, sentTo: d.sentTo, signedBy: d.signedBy
      });
      return d;
    },
    pullSheet(from, to) {
      return call('GET', `/api/reports/pull-sheet?${new URLSearchParams({ from, to })}`).then(r => r.rows);
    },
    utilisation() {
      return call('GET', '/api/reports/utilisation').then(r => r.rows);
    },

    /* keep the cached order in step with the server's version */
    absorbOrder(order) {
      if (!order?.id) return order;
      const list = adapter.all('orders');
      const i = list.findIndex(o => o.id === order.id);
      if (i > -1) Object.assign(list[i], order); else list.unshift(order);
      return order;
    }
  };

  return adapter;
}
