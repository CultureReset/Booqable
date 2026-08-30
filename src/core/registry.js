/* The registry is the seam that makes everything else pluggable.
   Nothing in core knows the names of any screen, field type, report,
   lifecycle transition, pricing strategy or availability rule — they
   all arrive here at load time and core reads them back generically. */

const reg = {
  modules: [],            // screens in the sidebar
  actions: new Map(),     // id -> fn(ctx)
  fieldTypes: new Map(),  // id -> { view, edit, parse, exportValue }
  panels: [],             // settings panels
  reports: [],            // report tabs
  documentTypes: [],      // quote / contract / invoice / packing slip
  pricing: new Map(),     // id -> fn(product, order) -> charge units
  availability: [],       // ordered reducers over an availability context
  moneySteps: [],         // ordered reducers over a money context
  entities: new Map(),    // id -> entity schema
  hooks: new Map()        // name -> [fn]
};

const sorted = list => [...list].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

export const Registry = {
  /* ---- screens ---- */
  module(def) {
    if (!def.id) throw new Error('module needs an id');
    reg.modules.push(def);
    Object.entries(def.actions || {}).forEach(([id, fn]) => Registry.action(id, fn));
    return def;
  },
  modules: () => sorted(reg.modules),
  moduleById: id => reg.modules.find(m => m.id === id),

  /* ---- actions: every data-act in the DOM resolves through here ---- */
  action(id, fn) { reg.actions.set(id, fn); },
  actions: (...defs) => defs.forEach(d => Object.entries(d).forEach(([k, v]) => reg.actions.set(k, v))),
  runAction(id, ctx) {
    const fn = reg.actions.get(id);
    if (!fn) return { handled: false };
    fn(ctx);
    return { handled: true };
  },
  hasAction: id => reg.actions.has(id),
  actionIds: () => [...reg.actions.keys()],

  /* ---- field types: drive forms, tables, documents and exports alike ---- */
  fieldType(id, def) { reg.fieldTypes.set(id, def); },
  getFieldType(id) { return reg.fieldTypes.get(id) || reg.fieldTypes.get('text'); },
  fieldTypeIds: () => [...reg.fieldTypes.keys()],

  /* ---- entity schemas ---- */
  entity(def) { reg.entities.set(def.id, def); return def; },
  getEntity: id => reg.entities.get(id),
  entities: () => [...reg.entities.values()],

  /* ---- settings ---- */
  panel(def) { reg.panels.push(def); return def; },
  panels: () => sorted(reg.panels),
  panelById: id => reg.panels.find(p => p.id === id),

  /* ---- reports ---- */
  report(def) { reg.reports.push(def); return def; },
  reports: () => sorted(reg.reports),
  reportById: id => reg.reports.find(r => r.id === id),

  /* ---- documents ---- */
  documentType(def) { reg.documentTypes.push(def); return def; },
  documentTypes: () => sorted(reg.documentTypes),
  documentTypeById: id => reg.documentTypes.find(d => d.id === id),

  /* ---- pricing strategies ---- */
  pricingStrategy(id, fn) { reg.pricing.set(id, fn); },
  getPricingStrategy: id => reg.pricing.get(id),
  pricingStrategyIds: () => [...reg.pricing.keys()],

  /* ---- availability pipeline: each rule subtracts from a running total ---- */
  availabilityRule(def) { reg.availability.push(def); return def; },
  availabilityRules: () => sorted(reg.availability),

  /* ---- money pipeline: ordered reducers from subtotal to total ---- */
  moneyStep(def) { reg.moneySteps.push(def); return def; },
  moneySteps: () => sorted(reg.moneySteps),

  /* ---- generic extension points ---- */
  hook(name, fn) { (reg.hooks.get(name) || reg.hooks.set(name, []).get(name)).push(fn); },
  fire(name, ctx) { (reg.hooks.get(name) || []).forEach(fn => fn(ctx)); },

  /* introspection — the Blueprint screen renders itself from this */
  describe: () => ({
    modules: reg.modules.length,
    actions: reg.actions.size,
    fieldTypes: reg.fieldTypes.size,
    entities: reg.entities.size,
    panels: reg.panels.length,
    reports: reg.reports.length,
    documentTypes: reg.documentTypes.length,
    pricingStrategies: reg.pricing.size,
    availabilityRules: reg.availability.length,
    moneySteps: reg.moneySteps.length
  })
};
