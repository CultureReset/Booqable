/* The Blueprint documents the app by reading the registry, not by
   repeating it. Register a module, a report, a field type or a
   lifecycle transition and it shows up here with no edit — which is
   also the cheapest proof that the architecture is actually modular. */

import { Registry } from '../core/registry.js';
import { Store } from '../core/store.js';
import { esc } from '../core/util.js';
import { pageHead, card, tile, tabs, banner, chip } from '../core/ui.js';
import { DataTable } from '../core/view.js';
import { Lifecycle } from '../schema/lifecycle.js';
import { panelGroups } from '../schema/settings.js';

const VIEWS = [
  { id: 'map', label: 'Screen map', render: screenMap },
  { id: 'flow', label: 'Order lifecycle', render: lifecycleView },
  { id: 'model', label: 'Data model', render: dataModel },
  { id: 'arch', label: 'Architecture', render: architecture },
  { id: 'parity', label: 'Web vs mobile', render: parity }
];

Registry.module({
  id: 'blueprint', label: 'Blueprint', icon: 'blueprint', order: 120, group: 'Account',

  render({ tabState }) {
    const active = tabState('blueprint.view', 'map');
    const view = VIEWS.find(v => v.id === active) || VIEWS[0];
    return `
    ${pageHead({
      title: 'Blueprint',
      sub: 'The whole dashboard, generated from the registry it is built on',
      actions: '<button class="btn" data-act="export.csv" data-entity="blueprint">Export map</button>'
    })}
    ${tabs(VIEWS.map(v => ({ id: v.id, label: v.label })), view.id, 'blueprint.view')}
    ${view.render()}`;
  }
});

/* ---------- screen map, generated from registered modules ---------- */
function screenMap() {
  const mods = Registry.modules();
  return `<div class="stack">
    ${card({
      title: 'Navigation tree', head: '<span class="eyebrow">generated from Registry.modules()</span>',
      body: `<div class="bp-tree">
        <div class="n1"><a class="act" data-act="order.new" href="#">+ New order</a> <span class="pipe">shortcut</span></div>
        ${mods.map(m => {
          const sub = subEntries(m);
          return `<div class="n1"><a class="act" data-go="${m.id}" href="#/${m.id}">${esc(m.label)}</a> <span class="pipe">#/${m.id}</span></div>
            ${sub.map((s, i) => `<div class="n2">${i === sub.length - 1 ? '└─' : '├─'} ${esc(s)}</div>`).join('')}`;
        }).join('')}
      </div>`
    })}
    <div class="cols c2">
      ${mods.map(m => `<div class="mapcard">
        <h4>${esc(m.label)}</h4>
        <div class="path">${m.device ? 'device: ' + esc(m.device) : '#/' + esc(m.id)}${m.detail ? ' · #/' + esc(m.id) + '/:id' : ''}</div>
        <div class="muted" style="font-size:12.5px;margin-bottom:8px">${esc(describeModule(m))}</div>
        <ul>${moduleActions(m).map(a => `<li><span class="mono" style="font-size:11.5px">${esc(a)}</span></li>`).join('')
          || '<li class="dim">No registered actions — this screen is read-only.</li>'}</ul>
      </div>`).join('')}
    </div>
  </div>`;
}

function subEntries(m) {
  const out = [];
  if (m.id === 'orders') out.push('Filters: ' + 'Open / All / Concepts / Reserved / Picked up / Returned / Overdue / Archived / Canceled',
    'Detail tabs: Items & pricing · Documents · Payments · Notes · Activity · Custom fields');
  if (m.id === 'documents') out.push('Types: ' + Registry.documentTypes().map(t => t.label).join(' · '));
  if (m.id === 'products') out.push('Detail tabs: General · Pricing · Inventory · Availability · Online store · Notes');
  if (m.id === 'customers') out.push('Detail tabs: Orders · Documents · Notes · Profile & fields');
  if (m.id === 'reports') out.push('Reports: ' + Registry.reports().map(r => r.label).join(' · '));
  if (m.id === 'settings') out.push(...panelGroups().map(g => `${g.name}: ${g.items.map(p => p.label).join(' · ')}`));
  if (m.id === 'calendar') out.push('Views: Orders month grid · Availability matrix');
  if (m.id === 'dashboard') out.push('Pickups · Returns · Notes · Activity');
  return out;
}
const DESCRIPTIONS = {
  dashboard: 'The daily rental organiser. Nothing else on the sidebar answers "what happens today".',
  orders: 'Every booking, and the screen where the whole lifecycle actually happens.',
  calendar: 'The same orders on a time axis, plus product-level availability.',
  documents: 'Everything customer-facing that an order produced.',
  customers: 'CRM: who rents from you and what they are worth.',
  products: 'Inventory: what you own, what it costs, what is free.',
  store: 'The self-service front end customers book through.',
  reports: 'Where the money and the equipment actually went.',
  apps: 'Integrations and the public API surface.',
  settings: 'Everything that shapes how orders price, print, email and behave.',
  blueprint: 'This page. Generated from the registry so it cannot go stale.',
  pos: 'The warehouse-counter app. Same data, different job: move items, not edit them.'
};
const describeModule = m => DESCRIPTIONS[m.id] || '';
const moduleActions = m => Object.keys(m.actions || {});

/* ---------- lifecycle, generated from the state machine ---------- */
function lifecycleView() {
  const pos = {
    new: [40, 34], concept: [190, 34], reserved: [360, 34], started: [530, 34],
    stopped: [700, 34], archived: [700, 130], mixed: [530, 130], canceled: [190, 130]
  };
  const cw = 124, ch = 34;
  const box = id => {
    const [x, y] = pos[id];
    const s = Lifecycle.states[id];
    return `<g><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="7" fill="var(--st-${s.tone}-bg)" stroke="var(--st-${s.tone})" stroke-width="1.4"/>
      <text x="${x + cw / 2}" y="${y + ch / 2 + 4}" text-anchor="middle" fill="var(--st-${s.tone})" style="font-weight:600;font-size:12px">${esc(s.label)}</text></g>`;
  };
  const R = id => ({ x: pos[id][0], y: pos[id][1], r: pos[id][0] + cw, b: pos[id][1] + ch, cx: pos[id][0] + cw / 2, cy: pos[id][1] + ch / 2 });
  const arrow = (a, b, label, dashed) => `<g>
    <path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" stroke="var(--line-strong)" stroke-width="1.6" fill="none" marker-end="url(#ah)"${dashed ? ' stroke-dasharray="4 3"' : ''}/>
    ${label ? `<text x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2 - 6}" text-anchor="middle" fill="var(--text-3)" style="font-size:10.5px">${esc(label)}</text>` : ''}</g>`;

  return `<div class="stack">
    ${card({
      title: 'Order state machine', head: '<span class="eyebrow">what each transition really does to stock</span>',
      body: `<div class="fsm"><svg viewBox="0 0 850 185" style="width:100%;min-width:700px" role="img" aria-label="Order status flow">
        <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--line-strong)"/></marker></defs>
        ${arrow([R('new').r, R('new').cy], [R('concept').x, R('concept').cy], 'save')}
        ${arrow([R('concept').r, R('concept').cy], [R('reserved').x, R('reserved').cy], 'reserve')}
        ${arrow([R('reserved').r, R('reserved').cy], [R('started').x, R('started').cy], 'pick up')}
        ${arrow([R('started').r, R('started').cy], [R('stopped').x, R('stopped').cy], 'return')}
        ${arrow([R('stopped').cx, R('stopped').b], [R('archived').cx, R('archived').y], 'archive')}
        ${arrow([R('started').cx, R('started').b], [R('mixed').cx, R('mixed').y], 'partial')}
        ${arrow([R('mixed').r, R('mixed').cy], [R('stopped').cx - 10, R('stopped').b + 6], 'all back', true)}
        ${arrow([R('concept').cx, R('concept').b], [R('canceled').cx, R('canceled').y], 'cancel')}
        ${arrow([R('reserved').x + 6, R('reserved').b], [R('canceled').r, R('canceled').cy], 'cancel', true)}
        ${Object.keys(pos).map(box).join('')}
      </svg></div>
      ${DataTable({
        columns: [
          { key: 'state', label: 'Status', type: 'custom', render: r => chip(Lifecycle.label(r.id), Lifecycle.tone(r.id)) },
          { key: 'stock', label: 'Stock is…', type: 'text', cellStyle: 'font-weight:500' },
          { key: 'meaning', label: 'What it means operationally', type: 'custom',
            render: r => `<span class="muted" style="font-size:12.5px">${esc(r.meaning)}</span>` },
          { key: 'actions', label: 'Available actions', type: 'custom',
            render: r => `<span class="dim" style="font-size:12px">${esc(r.actions)}</span>` }
        ],
        rows: Object.entries(Lifecycle.states).map(([id, s]) => ({
          id, stock: s.stockNote, meaning: s.meaning, actions: Lifecycle.actionsFor(id).join(' · ')
        }))
      })}`
    })}
    ${card({
      title: 'How availability is computed', head: '<span class="eyebrow">one row per registered rule</span>',
      body: `<div class="bp-tree" style="font-size:13px;line-height:2">
        <div><span class="act">available(product, from, to)</span> =</div>
        <div class="n2">&nbsp;&nbsp;units owned</div>
        ${Registry.availabilityRules().map(r => `<div class="n2">&nbsp;&nbsp;− ${esc(r.label)} <span class="dim">(${esc(r.id)})</span></div>`).join('')}
        <div class="n2">&nbsp;&nbsp;&nbsp;&nbsp;…where every rental is widened by its <b>buffer time</b> at both ends</div>
      </div>
      ${banner('info', 'A shortage is not automatically an error. If a product allows shortages, a booking may exceed stock up to its shortage limit — the assumption being you will sub-rent or borrow in time. Past that limit, the order is blocked.')}`
    })}
  </div>`;
}

/* ---------- data model, generated from entity schemas ---------- */
function dataModel() {
  return `<div class="stack">
    ${card({
      title: 'Entities', head: '<span class="eyebrow">generated from Registry.entities()</span>',
      body: DataTable({
        columns: [
          { key: 'label', label: 'Entity', type: 'text', cellStyle: 'font-weight:600' },
          { key: 'count', label: 'Records', type: 'number', align: 'right' },
          { key: 'fields', label: 'Fields', type: 'custom',
            render: e => `<span class="mono" style="font-size:11.5px;color:var(--text-2)">${esc(e.fields)}</span>` }
        ],
        rows: Registry.entities().map(e => ({
          id: e.id, label: e.label,
          count: safeCount(e.id),
          fields: e.fields.map(f => f.key).join(', ')
        }))
      })
    })}
    ${card({
      title: 'The money calculation, in order', head: '<span class="eyebrow">one row per registered step</span>',
      body: `<div class="bp-tree" style="font-size:13px;line-height:2">
        <div class="n1">line charge = quantity × price each × <span class="act">charge units</span></div>
        <div class="n3">&nbsp;&nbsp;&nbsp;charge units come from the pricing strategy: ${Registry.pricingStrategyIds().map(s => `<span class="kbd">${esc(s)}</span>`).join(' ')}</div>
        ${Registry.moneySteps().map((s, i) => `<div class="n1">${i + 1}. ${esc(s.label)}${
          s.kind === 'deduction' ? ' <span class="dim">(subtracted)</span>' : s.kind === 'addition' ? ' <span class="dim">(added)</span>' : ''}</div>`).join('')}
        <div class="n1">= <b>total</b> · − payments received = <b>outstanding</b></div>
        <div class="n3">&nbsp;&nbsp;&nbsp;the security deposit sits outside this: held, then captured or released</div>
      </div>`
    })}
    ${card({
      title: 'Registered field types', head: '<span class="eyebrow">shared by tables, forms, documents and exports</span>',
      body: `<div class="wrap">${Registry.fieldTypeIds().map(t => `<span class="kbd">${esc(t)}</span>`).join('')}</div>
      <div class="dim" style="font-size:12px;margin-top:9px">A field declares its type once. The table cell, the form control, the document line and the CSV column all come from that one declaration.</div>`
    })}
  </div>`;
}
const safeCount = id => { try { return Store.count(id); } catch { return 0; } };

/* ---------- architecture ---------- */
function architecture() {
  const d = Registry.describe();
  return `<div class="stack">
    <div class="tiles">
      ${tile('Screens', d.modules, 'registered modules')}
      ${tile('Actions', d.actions, 'all dispatched by name')}
      ${tile('Entities', d.entities, 'field schemas')}
      ${tile('Field types', d.fieldTypes, 'shared renderers')}
      ${tile('Settings panels', d.panels, 'no per-panel code')}
      ${tile('Reports', d.reports, 'self-registering')}
      ${tile('Availability rules', d.availabilityRules, 'composable pipeline')}
      ${tile('Money steps', d.moneySteps, 'ordered reducers')}
    </div>
    ${card({
      title: 'How a change lands', head: '<span class="eyebrow">where you edit, and what follows</span>',
      body: DataTable({
        columns: [
          { key: 'want', label: 'To change this…', type: 'text', cellStyle: 'font-weight:500' },
          { key: 'edit', label: 'Edit here', type: 'mono' },
          { key: 'gets', label: '…and this follows automatically', type: 'custom',
            render: r => `<span class="muted" style="font-size:12.5px">${esc(r.gets)}</span>` }
        ],
        rows: [
          ['Add a screen', 'src/modules/<name>.js', 'Sidebar entry, route, badge, actions, and its own card on this page'],
          ['Add a field to an entity', 'src/schema/entities.js', 'The table column, the form control, the document line and the CSV export'],
          ['Change the workflow', 'src/schema/lifecycle.js', 'Action bar buttons, the stepper, guards, the POS buttons and the table above'],
          ['Add a pricing model', 'Registry.pricingStrategy()', "Every product's pricing dropdown and all order totals"],
          ['Add an availability constraint', 'Registry.availabilityRule()', 'Every availability read: calendar, product page, shortages, pull sheet'],
          ['Insert a charge or levy', 'Registry.moneyStep()', 'Order totals, invoices and the money breakdown above'],
          ['Add a document type', 'Registry.documentType()', 'Order generate buttons, the Documents tabs, templates settings, the preview'],
          ['Add a settings panel', 'Registry.panel()', 'The settings sidebar and its rendering — no new markup'],
          ['Add a report', 'Registry.report()', 'The Reports tab bar'],
          ['Point at a live account', 'Store.init(RestAdapter(…))', 'Every screen, unchanged']
        ].map((r, i) => ({ id: 'row' + i, want: r[0], edit: r[1], gets: r[2] }))
      })
    })}
    ${card({
      title: 'Layers', body: `<div class="bp-tree" style="font-size:12.5px;line-height:1.95">
        <div class="n1">src/core/       <span class="pipe">— knows no screen names</span></div>
        <div class="n3">&nbsp;&nbsp;registry.js  the seam: modules, actions, field types, rules</div>
        <div class="n3">&nbsp;&nbsp;store.js     entity access over a swappable adapter</div>
        <div class="n3">&nbsp;&nbsp;adapters/    memory.js · rest.js (same interface)</div>
        <div class="n3">&nbsp;&nbsp;fields.js    field types: view / edit / export</div>
        <div class="n3">&nbsp;&nbsp;view.js      DataTable · Form · FieldList · toCSV</div>
        <div class="n3">&nbsp;&nbsp;app.js       shell, routing, one delegated listener set</div>
        <div class="n1">src/schema/     <span class="pipe">— the domain, as data</span></div>
        <div class="n3">&nbsp;&nbsp;entities.js · lifecycle.js · pricing.js · availability.js · documents.js · settings.js</div>
        <div class="n1">src/modules/    <span class="pipe">— one file per screen, each self-registering</span></div>
        <div class="n3">&nbsp;&nbsp;${Registry.modules().map(m => m.id).join(' · ')}</div>
        <div class="n1">src/data/seed.js <span class="pipe">— pure data, no behaviour</span></div>
      </div>
      <div class="dim" style="font-size:12px;margin-top:10px">Current data source: <span class="kbd">${esc(Store.adapterName())}</span>.
        The screens never import the seed; they read through <span class="kbd">Store</span>.</div>`
    })}
  </div>`;
}

function parity() {
  const rows = [
    ["See today's pickups and returns", 'Full panels with notes and activity', 'Dashboard list, date-filtered'],
    ['Create an order', 'Full builder: products, dates, pricing, fields', 'Yes — quick create with scan-to-add'],
    ['Edit pricing and discounts', 'Yes', 'No — read-only totals'],
    ['Pick up items', 'Per-line, choose stock items, scan', 'Yes — the primary job'],
    ['Return items', 'Per-line, damage & deposit handling', 'Yes'],
    ['Take payment', 'Card, link, manual, deposits', 'Manual + Tap to Pay; no card-on-file'],
    ['Collect a signature', 'Yes', 'Yes — on-glass'],
    ['Barcode / QR scanning', 'Keyboard-wedge scanners', 'Camera scanner built in'],
    ['Documents', 'Generate, send, e-sign', 'View and send only'],
    ['Products & inventory', 'Full CRUD, stock items, downtime', 'Look up and check availability'],
    ['Reports', 'All six reports, export, print', 'No'],
    ['Settings', 'All', 'No']
  ];
  return `<div class="card"><div class="card-head"><h3>What each device is for</h3>
    <span class="eyebrow">same data, different jobs</span></div>
    ${DataTable({
      columns: [
        { key: 'cap', label: 'Capability', type: 'text', cellStyle: 'font-weight:500' },
        { key: 'web', label: 'Web dashboard', type: 'custom', render: r => `<span class="muted" style="font-size:12.5px">${esc(r.web)}</span>` },
        { key: 'pos', label: 'Mobile POS', type: 'custom', render: r => `<span class="muted" style="font-size:12.5px">${esc(r.pos)}</span>` }
      ],
      rows: rows.map((r, i) => ({ id: 'p' + i, cap: r[0], web: r[1], pos: r[2] }))
    })}
    <div class="card-body" style="border-top:1px solid var(--line)">
      ${banner('info', '<b>The split is deliberate.</b> The web dashboard is where an order is designed and priced; the mobile POS is where equipment physically moves. Anything that changes money lives on the web; anything that changes possession works on the phone, offline-tolerant and one-handed.')}
      <div class="row" style="margin-top:12px"><button class="btn primary" data-device="pos">Open the mobile POS →</button></div>
    </div></div>`;
}
