/* In-memory adapter. Holds collections in plain arrays and satisfies the
   whole Store interface, so the app runs with no backend at all. */

import { uid } from '../util.js';

export function MemoryAdapter(seed) {
  const data = {};
  const config = {};

  Object.entries(seed).forEach(([k, v]) => {
    if (Array.isArray(v)) data[k] = v.slice();
    else config[k] = v;
  });

  return {
    name: 'memory',
    collections: () => Object.keys(data),

    all(entity) { return data[entity] || (data[entity] = []); },
    get(entity, id) { return this.all(entity).find(r => r.id === id) || null; },

    insert(entity, record) {
      const r = { id: record.id || uid(entity.slice(0, 2)), ...record };
      this.all(entity).unshift(r);
      return r;
    },
    update(entity, id, patch) {
      const r = this.get(entity, id);
      if (r) Object.assign(r, patch);
      return r;
    },
    remove(entity, id) {
      const list = this.all(entity);
      const i = list.findIndex(r => r.id === id);
      if (i > -1) list.splice(i, 1);
    },

    config(key) { return key === undefined ? config : config[key]; },
    setConfig(key, value) {
      if (typeof value === 'object' && !Array.isArray(value) && config[key]) Object.assign(config[key], value);
      else config[key] = value;
    }
  };
}
