/* The settings screen renders panels generically from their `kind`.
   There is no per-panel branching: the eighteen panels in
   schema/settings.js are data, and the four renderers below cover them. */

import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { esc, D, uid } from '../core/util.js';
import { pageHead, card, toast, icon, chip, tile, empty } from '../core/ui.js';
import { money, money0, fmtDT, fmtDY, setValue } from '../core/fields.js';
import { DataTable, Form } from '../core/view.js';
import { render } from '../core/app.js';
import { panelGroups } from '../schema/settings.js';
import { taxRateFor } from '../schema/pricing.js';

const KINDS = {
  form: panel => card({
    title: panel.title, sub: panel.sub,
    body: `${Form({ fields: panel.fields, record: Store.config(panel.config), scope: `config:${panel.config}` })}
      ${panel.note ? `<div class="banner ${panel.note.tone}" style="margin-top:16px"><div>${panel.note.html}</div></div>` : ''}
      ${panel.save ? `<div class="row" style="margin-top:16px"><button class="btn primary" data-act="${panel.save}">Save changes</button></div>` : ''}`
  }),

  table: panel => `<div class="card">
    <div class="card-head"><div><h3>${esc(panel.title)}</h3>${panel.sub ? `<div class="dim" style="font-size:12px;margin-top:2px">${esc(panel.sub)}</div>` : ''}</div>
      ${panel.add ? `<button class="btn sm"${panel.addAction ? ` data-act="${panel.addAction}"` : ''}>${icon('plus', 13, 2.4)} ${esc(panel.add)}</button>` : ''}</div>
    ${DataTable({ entity: panel.entity, columns: panel.columns, rows: panel.rows(), empty: empty('Nothing configured yet') })}
  </div>`,

  switches: panel => {
    const note = typeof panel.note === 'function' ? panel.note() : panel.note;
    return card({
      title: panel.title, sub: panel.sub,
      body: `${panel.items().map(it => `<div class="switch-row">
          <button class="switch ${it.on ? 'on' : ''}"${it.action ? ` data-act="${it.action}" data-id="${it.id}"` : ''} aria-pressed="${!!it.on}"></button>
          <div class="grow"><div class="t">${esc(it.label)}</div>${it.help ? `<div class="d">${esc(it.help)}</div>` : ''}</div>
          ${it.badge ? chip(it.badge.label, it.badge.tone, false) : ''}
        </div>`).join('')}
        ${(panel.extra || []).map(it => `<div class="switch-row">
          <button class="switch ${it.on ? 'on' : ''}"></button>
          <div><div class="t">${esc(it.label)}</div>${it.help ? `<div class="d">${esc(it.help)}</div>` : ''}</div>
        </div>`).join('')}
        ${note ? `<div class="banner ${note.tone}" style="margin-top:16px"><div>${note.html}</div></div>` : ''}`
    });
  },

  custom: panel => CUSTOM[panel.render](panel)
};

/* Custom panels are still registered renderers, keyed by name — not an
   if/else chain, and reachable from other files. */
const CUSTOM = {
  'settings.pricing': () => card({
    title: 'Pricing defaults', sub: 'How charges are calculated before per-product overrides.',
    body: `<div class="grid2">
      <div class="field"><label>Default charge period</label><select><option>Per day</option><option>Per hour</option><option>Per week</option></select></div>
      <div class="field"><label>Prices include tax</label><select><option>No — tax added at checkout</option><option>Yes — tax-inclusive display</option></select></div>
      <div class="field"><label>Rounding</label><select><option>Nearest cent</option><option>Nearest whole unit</option></select></div>
      <div class="field"><label>Default security deposit</label><input type="number" value="0"></div>
    </div>
    <div class="eyebrow" style="margin:18px 0 8px">Pricing structure templates</div>
    ${Data.pricingStructures().map(s => `<div class="card" style="margin-bottom:10px">
      <div class="card-head"><h3>${esc(s.name)}</h3><button class="btn sm">Edit</button></div>
      <div class="card-body" style="padding:10px 14px">
        <div class="wrap">${s.rows.map(r => `<span class="chip plain">${esc(r.label)} <b class="num">×${r.mult}</b></span>`).join('')}</div>
        <div class="dim" style="font-size:12px;margin-top:7px">Used by ${Data.products().filter(p => p.structure === s.id).length} products.</div>
      </div></div>`).join('')}
    <div class="eyebrow" style="margin:18px 0 8px">Registered pricing strategies</div>
    <div class="wrap">${Registry.pricingStrategyIds().map(id => `<span class="chip info">${esc(id)}</span>`).join('')}</div>
    <div class="dim" style="font-size:12px;margin-top:7px">A new strategy is one <span class="kbd">Registry.pricingStrategy()</span> call; it appears in every product's pricing dropdown automatically.</div>
    <div class="switch-row" style="margin-top:14px"><button class="switch on"></button>
      <div><div class="t">Allow manual price overrides on orders</div><div class="d">Staff can type a different price on any line. It is logged in the activity trail.</div></div></div>
    <div class="switch-row"><button class="switch"></button>
      <div><div class="t">Hide prices in the online store</div><div class="d">Turns every product into a quote request.</div></div></div>`
  }),

  'settings.tax': () => `<div class="stack">
    <div class="card"><div class="card-head"><h3>Tax rates</h3><button class="btn sm">${icon('plus', 13, 2.4)} Add rate</button></div>
      ${DataTable({ entity: 'taxRates', columns: ['name', 'kind', 'rate'], rows: Data.taxRates() })}</div>
    <div class="card"><div class="card-head"><div><h3>Tax profiles</h3>
      <div class="dim" style="font-size:12px;margin-top:2px">A profile bundles one or more rates and is assigned to products and customers.</div></div></div>
      ${DataTable({
        columns: [
          { key: 'name', label: 'Profile', type: 'custom', render: p => `${esc(p.name)}${p.default ? ' <span class="chip plain">default</span>' : ''}` },
          { key: 'rates', label: 'Rates', type: 'custom', render: p => p.rates.map(r => `<span class="tag">${esc(Data.taxRates().find(x => x.id === r).name)}</span>`).join(' ') },
          { key: 'eff', label: 'Effective', align: 'right', type: 'custom', render: p => `<span class="num">${taxRateFor(p.id)}%</span>` },
          { key: 'used', label: 'Used by', type: 'custom', render: p => `<span class="dim" style="font-size:12px">${
            Data.products().filter(x => x.taxProfile === p.id).length} products · ${Data.customers().filter(x => x.taxProfile === p.id).length} customers</span>` }
        ], rows: Data.taxProfiles() })}</div>
  </div>`,

  'settings.tags': () => `<div class="cols c2">
    ${card({ title: 'Tags', sub: 'Free-form labels on products, customers and orders.',
      body: `<div class="wrap">${Data.tagList().map(t => `<span class="chip plain">${esc(t)} <span class="dim num">${
        Data.products().filter(p => p.tags.includes(t)).length + Data.customers().filter(c => c.tags.includes(t)).length}</span></span>`).join('')}</div>
        <button class="btn sm" style="margin-top:12px">${icon('plus', 13, 2.4)} New tag</button>` })}
    ${card({ title: 'Collections', sub: 'Structured groups that also appear in the online store.',
      body: Data.collections().map(col => `<div class="checkline"><span class="grow" style="font-weight:500">${esc(col.name)}</span>
        <span class="dim num">${Data.products().filter(p => p.collection === col.id).length} products</span>
        ${chip(col.online ? 'Online' : 'Internal', col.online ? 'good' : 'plain', false)}</div>`).join('') })}
  </div>`,

  'settings.emails': () => `<div class="card"><div class="card-head"><h3>Email templates</h3></div>
    ${DataTable({
      columns: [
        { key: 'name', label: 'Template', type: 'text', cellStyle: 'font-weight:500' },
        { key: 'type', label: 'Type', type: 'custom', render: e => `<span class="tag">${esc(e.type)}</span>` },
        { key: 'trigger', label: 'Fires on', type: 'custom', render: e => `<span class="dim" style="font-size:12px">${esc(e.trigger)}</span>` },
        { key: 'subject', label: 'Subject', type: 'mono' },
        { key: 'on', label: 'Active', align: 'right', type: 'custom',
          render: e => `<button class="switch ${e.on ? 'on' : ''}" data-act="email.toggle" data-id="${e.id}" aria-pressed="${e.on}"></button>` }
      ], rows: Data.emailTemplates() })}
    <div class="card-body" style="border-top:1px solid var(--line)">
      <div class="eyebrow" style="margin-bottom:7px">Variables you can drop into any template</div>
      <div class="wrap">${['{{order.number}}', '{{order.starts_at}}', '{{order.stops_at}}', '{{order.total}}', '{{order.payment_url}}',
        '{{customer.name}}', '{{customer.email}}', '{{company.name}}', '{{company.phone}}', '{{document.url}}']
        .map(v => `<span class="kbd">${esc(v)}</span>`).join('')}</div>
    </div></div>`,

  /* Reads the document-type registry, so a new type appears here too. */
  'settings.documents': () => `<div class="card"><div class="card-head"><h3>Document templates</h3></div>
    ${DataTable({
      columns: [
        { key: 'label', label: 'Type', type: 'text', cellStyle: 'font-weight:500' },
        { key: 'numbering', label: 'Numbering', type: 'custom', render: t => `<span class="mono">${esc(t.prefix)}{{seq}}</span>` },
        { key: 'next', label: 'Next number', align: 'right', type: 'custom', render: t => `<span class="num">${t.seq + 1}</span>` },
        { key: 'flags', label: 'Shows', type: 'custom', render: t => [
            t.showPrices ? 'prices' : null, t.signature ? 'signature' : null,
            t.checkboxes ? 'check column' : null, t.showPayments ? 'payments' : null
          ].filter(Boolean).map(x => `<span class="tag">${x}</span>`).join(' ') },
        { key: 'css', label: 'Custom CSS', type: 'custom', render: t => chip(t.css ? 'Yes' : 'Default', t.css ? 'good' : 'plain', false) },
        { key: 'act', label: '', align: 'right', type: 'custom', render: () => '<button class="btn sm">Edit template</button>' }
      ], rows: Registry.documentTypes().map(t => ({ ...t })) })}
    <div class="card-body" style="border-top:1px solid var(--line)">
      ${Registry.documentTypes().map(t => `<div class="field" style="margin-bottom:12px">
        <label>${esc(t.label)} terms</label><textarea style="min-height:52px">${esc(t.terms)}</textarea></div>`).join('')}
    </div></div>`,

  'settings.team': () => `<div class="card">
    <div class="card-head"><h3>Team & permissions</h3><button class="btn sm">${icon('plus', 13, 2.4)} Invite member</button></div>
    ${DataTable({ entity: 'users', columns: ['name', 'email', 'role', 'twofa', 'last',
      { key: 'act', label: '', align: 'right', type: 'custom', render: () => '<button class="btn sm">Permissions</button>' }],
      rows: Data.users() })}
    <div class="card-body" style="border-top:1px solid var(--line)">
      <div class="eyebrow" style="margin-bottom:8px">What each role can do</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Capability</th>
        ${['Owner', 'Operator', 'Warehouse', 'Finance'].map(r => `<th>${r}</th>`).join('')}</tr></thead>
        <tbody>${PERMISSIONS.map(r => `<tr class="norow"><td>${esc(r[0])}</td>${r.slice(1).map(v =>
          `<td>${v ? '<span style="color:var(--good)">●</span>' : '<span class="dim">—</span>'}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
    </div></div>`,

  'settings.api': () => `<div class="card">
    <div class="card-head"><h3>API & webhooks</h3><button class="btn sm">${icon('plus', 13, 2.4)} New key</button></div>
    ${DataTable({
      columns: [
        { key: 'name', label: 'Name', type: 'text', cellStyle: 'font-weight:500' },
        { key: 'prefix', label: 'Key', type: 'mono' },
        { key: 'scopes', label: 'Scopes', type: 'mono' },
        { key: 'created', label: 'Created', type: 'date' },
        { key: 'lastUsed', label: 'Last used', type: 'text' },
        { key: 'act', label: '', align: 'right', type: 'custom', render: () => '<button class="btn sm danger">Revoke</button>' }
      ], rows: Data.apiKeys() })}
    <div class="card-body" style="border-top:1px solid var(--line)">
      <div class="eyebrow" style="margin-bottom:8px">Webhooks</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Event</th><th>Endpoint</th><th>Status</th></tr></thead><tbody>
        ${WEBHOOKS.map(r => `<tr class="norow"><td class="mono">${esc(r[0])}</td>
          <td class="mono dim" style="font-size:11.5px">${esc(r[1])}</td><td>${chip(r[2], 'good', false)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="dim" style="font-size:12px;margin-top:10px">Current data source: <span class="kbd">${esc(Store.adapterName())}</span>.
        Swapping in <span class="kbd">RestAdapter</span> points every screen at a live Booqable account with no other change.</div>
    </div></div>`,

  'settings.activity': panel => card({
    title: panel.title, sub: panel.sub,
    head: '<button class="btn sm" data-act="export.csv" data-entity="activity">Export</button>',
    body: `<div class="tl">${Data.activity().slice().sort((a, b) => D(b.when) - D(a.when)).map(a => {
      const o = Data.order(a.orderId);
      return `<div class="tl-item ${a.hi ? 'hi' : ''}"><div class="tl-when">${fmtDT(a.when)} · ${esc(a.by)}</div>
        <div class="tl-what">${esc(a.what)} ${o ? `<a href="#/orders/${o.id}" class="mono" data-go="orders" data-param="${o.id}">#${o.number}</a>` : ''}</div></div>`;
    }).join('')}</div>`
  }),

  'settings.billing': () => card({
    title: 'Plan & billing',
    body: `<div class="tiles" style="margin-bottom:16px">
      ${tile('Plan', Data.company().plan, 'billed annually')}
      ${tile('Team members', `${Data.users().length} / 10`, 'included in Pro')}
      ${tile('Orders this month', Data.orders().filter(o => D(o.createdAt).getMonth() === new Date().getMonth()).length, 'unlimited on Pro')}
      ${tile('Next invoice', money0(2388), 'renews 01 Mar 2027')}
    </div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Feature</th><th>Essential</th><th>Pro</th><th>Premium</th></tr></thead>
      <tbody>${PLANS.map(r => `<tr class="norow"><td>${esc(r[0])}</td>${r.slice(1).map((v, i) =>
        `<td style="${i === 1 ? 'font-weight:700;color:var(--accent)' : ''}">${v}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`
  })
};

const PERMISSIONS = [
  ['Create & edit orders', 1, 1, 0, 0], ['Pick up / return items', 1, 1, 1, 0],
  ['See prices & totals', 1, 1, 0, 1], ['Take payments & refunds', 1, 1, 0, 1],
  ['Edit products & stock', 1, 1, 1, 0], ['Change settings', 1, 0, 0, 0],
  ['Invite team members', 1, 0, 0, 0], ['Export data', 1, 1, 0, 1]
];
const WEBHOOKS = [
  ['order.reserved', 'https://hooks.northlight.internal/booqable', 'Healthy'],
  ['order.started', 'https://hooks.northlight.internal/booqable', 'Healthy'],
  ['order.stopped', 'https://hooks.northlight.internal/booqable', 'Healthy'],
  ['payment.succeeded', 'https://hooks.zapier.com/…/a91f', 'Healthy']
];
const PLANS = [
  ['Orders & inventory', '●', '●', '●'], ['Online store', '●', '●', '●'], ['Mobile POS', '—', '●', '●'],
  ['Multiple locations', '—', '●', '●'], ['Custom documents & CSS', '—', '●', '●'],
  ['SSO & IP restrictions', '—', '—', '●'], ['API access', '—', '●', '●'], ['Priority support', '—', '—', '●']
];

Registry.module({
  id: 'settings', label: 'Settings', icon: 'settings', order: 110, group: 'Account',

  render({ S }) { return page(S, S.tab['settings.panel'] || 'company'); },
  /* A settings deep-link (#/settings/coupons) selects the panel. */
  detail(id, { S }) { S.tab['settings.panel'] = id; return page(S, id); },

  actions: {
    'settings.saveCompany': ({ render }) => { Store.changed('config'); toast('Company information saved'); render(); },
    'settings.saveLabels': ({ render }) => { Store.changed('config'); toast('Labels saved — the whole account now uses them'); render(); },
    'settings.saveDefaults': ({ render }) => { Store.changed('config'); toast('Order defaults saved'); render(); },
    'coupon.new': ({ render }) => {
      const code = prompt('Coupon code', 'SUMMER10');
      if (!code) return;
      Store.insert('coupons', { id: uid('cpn'), code: code.toUpperCase(), kind: 'Percentage',
        value: 10, uses: 0, limit: 0, active: true, note: 'Created just now' });
      toast(`${code.toUpperCase()} created`); render();
    },
    'email.toggle': ({ data, render }) => {
      const t = Data.emailTemplates().find(x => x.id === data.id);
      t.on = !t.on; Store.changed('emailTemplates');
      toast(`${t.name} ${t.on ? 'enabled' : 'disabled'}`); render();
    },
    'provider.toggle': ({ data, render }) => {
      const p = Data.providers().find(x => x.id === data.id);
      p.on = !p.on; Store.changed('providers');
      toast(`${p.name} ${p.on ? 'enabled' : 'disabled'}`); render();
    }
  }
});

function page(S, activeId) {
  const panel = Registry.panelById(activeId) || Registry.panels()[0];
  return `
  ${pageHead({ title: 'Settings', sub: 'Everything that shapes how orders price, print, email and behave' })}
  <div class="cols" style="grid-template-columns:220px minmax(0,1fr)">
    <aside class="card" style="align-self:start;padding:8px">
      ${panelGroups().map(g => `<div class="eyebrow" style="padding:10px 10px 5px">${esc(g.name)}</div>
        ${g.items.map(p => `<button class="nav-item" data-tab="settings.panel" data-tab-value="${p.id}"
          style="color:${panel.id === p.id ? 'var(--accent-700)' : 'var(--text-2)'};background:${panel.id === p.id ? 'var(--accent-tint)' : 'transparent'}">${esc(p.label)}</button>`).join('')}`).join('')}
    </aside>
    <div>${KINDS[panel.kind](panel)}</div>
  </div>`;
}

Registry.hook('field-input', ({ scope, key, value }) => {
  if (!scope?.startsWith('config:')) return;
  const target = Store.config(scope.slice(7));
  if (!target) return;
  setValue(target, key, value);
  if (typeof value === 'boolean') render();
});
void money; void fmtDY;
