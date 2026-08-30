/* Composition root.

   This is the only file that knows the whole application exists. Boot
   order is: register the vocabulary (field types, entities, rules),
   attach a data source, load the screens, start the shell. Swap the
   adapter here to run against a live Booqable account; drop a module
   import to remove a screen. */

import { Store } from './core/store.js';
import { Registry } from './core/registry.js';
import { MemoryAdapter } from './core/adapters/memory.js';
import { RestAdapter } from './core/adapters/rest.js';
import { ApiAdapter } from './core/adapters/api.js';
import { registerCoreFieldTypes } from './core/fields.js';
import { boot } from './core/app.js';

import { buildSeed } from './data/seed.js';
import { registerEntities } from './schema/entities.js';
import { registerPricingStrategies, registerMoneySteps } from './schema/pricing.js';
import { registerAvailabilityRules } from './schema/availability.js';
import { registerDocumentTypes } from './schema/documents.js';
import { registerSettingsPanels } from './schema/settings.js';

/* Screens. Each import registers itself; order here sets nothing but
   load order — sidebar position comes from each module's `order`. */
import './modules/shell.js';
import './modules/dashboard.js';
import './modules/orders.js';
import './modules/calendar.js';
import './modules/documents.js';
import './modules/customers.js';
import './modules/products.js';
import './modules/storefront.js';
import './modules/reports.js';
import './modules/apps.js';
import './modules/settings.js';
import './modules/blueprint.js';
import './modules/pos.js';

import { registerReports } from './modules/reports.js';

export function start({ adapter } = {}) {
  registerCoreFieldTypes();
  registerPricingStrategies();
  registerMoneySteps();
  registerAvailabilityRules();
  registerDocumentTypes();

  /* The only line that decides where data comes from. `useRest()` below
     swaps it for a live Booqable account; no screen changes. */
  Store.init(adapter || MemoryAdapter(buildSeed()));

  registerEntities();
  registerSettingsPanels();
  registerReports();

  boot();
}

/* Point the running app at a live Booqable account from the console:
     await Booqable.useRest({ token: 'bq_live_…' })
   Every screen re-renders against real data; nothing else changes. */
export async function useRest(options) {
  const rest = RestAdapter(options);
  await rest.prime();
  Store.init(rest);
  Store.changed('*');
  return rest;
}

/* Point the app at this project's own Postgres backend:
     await Booqable.useApi({ baseUrl: 'http://localhost:4000',
                             email: 'maya@northlightrentals.com',
                             password: 'northlight-dev' })
   Reads come from the primed cache; reserving, fulfilling and taking
   payment go to the server, which can refuse. */
export async function useApi({ baseUrl = 'http://localhost:4000', email, password, token } = {}) {
  const api = ApiAdapter({ baseUrl, token, onError: err => console.warn('[api]', err.message) });
  if (!token) await api.signIn(email, password);
  await api.prime();
  Store.init(api);
  Store.changed('*');
  return api;
}

globalThis.Booqable = { Store, Registry, MemoryAdapter, RestAdapter, ApiAdapter, useRest, useApi, start };

start();
