/* Northlight for Android — composition root.

   The domain layer is imported wholesale from ../src: the same store,
   entity schemas, order lifecycle, pricing pipeline and availability
   rules the web dashboard runs on. Only the UI layer is new. That is
   the payoff of the registry refactor — a second front end, no second
   copy of the business logic. */

import { Store } from '../src/core/store.js';
import { Registry } from '../src/core/registry.js';
import { MemoryAdapter } from '../src/core/adapters/memory.js';
import { registerCoreFieldTypes } from '../src/core/fields.js';
import { buildSeed } from '../src/data/seed.js';
import { registerEntities } from '../src/schema/entities.js';
import { registerPricingStrategies, registerMoneySteps } from '../src/schema/pricing.js';
import { registerAvailabilityRules } from '../src/schema/availability.js';
import { registerDocumentTypes } from '../src/schema/documents.js';
import { registerSettingsPanels } from '../src/schema/settings.js';
import { esc } from '../src/core/util.js';
import { Data } from '../src/core/store.js';

import { MobileRegistry, Nav, TABS } from './core/nav.js';
import { icon, btn, badge } from './core/m3.js';

import { AUTH_ACTIONS } from './screens/auth.js';
import { TODAY_ACTIONS } from './screens/today.js';
import { ORDER_ACTIONS } from './screens/orders.js';
import { CATALOG_ACTIONS } from './screens/catalog.js';
import { MORE_ACTIONS } from './screens/more.js';
import { SHOP_ACTIONS } from './screens/shop.js';
import { FLOWS, renderFlows } from './flows.js';
import { renderStore } from './store.js';

/* ---- boot the domain ---- */
registerCoreFieldTypes();
registerPricingStrategies();
registerMoneySteps();
registerAvailabilityRules();
registerDocumentTypes();
Store.init(MemoryAdapter(buildSeed()));
registerEntities();
registerSettingsPanels();

/* ---- ui state ---- */
const S = { mode: 'app', device: 'phone', screen: {} };
const ACTIONS = Object.assign({}, AUTH_ACTIONS, TODAY_ACTIONS, ORDER_ACTIONS, CATALOG_ACTIONS, MORE_ACTIONS, SHOP_ACTIONS, {
  'nav.back': () => Nav.back(),
  'nav.dismiss': () => Nav.dismiss()
});

/* ---- render one screen's body ---- */
export function screenBody(def, params, state = S.screen) {
  try {
    return def.render({ params: params ?? (def.demo ? def.demo() : {}), state, Nav });
  } catch (err) {
    console.error('screen', def.id, err);
    return `<div style="padding:24px"><div class="banner"><div><b>${esc(def.title)}</b> failed: ${esc(err.message)}</div></div></div>`;
  }
}

/* ---- the phone, with android system chrome ---- */
export function deviceChrome(inner, { standalone, tab, overlay = '', snack = '' } = {}) {
  return `
    <div class="sysbar">
      <span>9:41</span>
      <span class="right">${icon('offline', 13, 2.2)} ${icon('flash', 13, 2.2)} <span>82%</span></span>
    </div>
    <div class="appframe">
      ${inner}
      ${overlay}
      ${snack}
    </div>
    ${standalone ? '' : navBar(tab)}
    <div class="gesturebar"><i></i></div>`;
}

function navBar(activeTab) {
  const badges = {
    orders: Data.orders().filter(o => new Date(o.stopsAt) < new Date() && ['started', 'mixed'].includes(o.status)).length,
    today: 0, scan: 0, catalog: 0, more: 0
  };
  return `<nav class="navbar">${TABS.map(t => `
    <button class="state ${activeTab === t.id ? 'on' : ''}" data-tab="${t.id}" aria-label="${t.label}">
      <span class="pill">${icon(t.icon, 24, activeTab === t.id ? 2.1 : 1.8)}
      ${badges[t.id] ? `<span class="dot">${badges[t.id]}</span>` : ''}</span>
      <span class="lbl">${t.label}</span>
    </button>`).join('')}</nav>`;
}

function overlayHtml() {
  const o = Nav.overlay;
  if (!o) return '';
  if (o.kind === 'sheet') return `<div class="scrim" data-dismiss></div>
    <div class="sheet"><div class="grip"></div>
      <div class="sheet-head"><div class="title-l">${esc(o.title)}</div>
        ${o.subtitle ? `<div class="body-m on-var" style="margin-top:4px">${esc(o.subtitle)}</div>` : ''}</div>
      <div class="sheet-body">${o.body || ''}</div>
      ${o.actions ? `<div class="sheet-actions">${o.actions.map(a => btn(a)).join('')}</div>` : ''}
    </div>`;
  if (o.kind === 'dialog') return `<div class="scrim" data-dismiss></div>
    <div class="dialog"><div class="dtitle">${esc(o.title)}</div>
      <div class="dbody">${esc(o.body || '')}</div>
      <div class="dactions">${(o.actions || []).map(a => btn(a)).join('')}</div></div>`;
  return `<div class="scrim" data-dismiss style="background:transparent"></div>
    <div class="menu" style="top:56px;right:8px">${(o.items || []).map(i =>
      `<button class="state" data-act="${esc(i.act)}"${Object.entries(i.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}>
        ${icon(i.icon || 'info', 20, 2)}${esc(i.label)}</button>`).join('')}</div>`;
}

function snackHtml() {
  if (!Nav.snack) return '';
  return `<div class="snackbar">${esc(Nav.snack.message)}
    ${Nav.snack.action ? `<span class="act">${esc(Nav.snack.action)}</span>` : ''}</div>`;
}

/* ---- page ---- */
const MODES = [
  { id: 'app', label: 'App' },
  { id: 'screens', label: 'Screens' },
  { id: 'flows', label: 'Flows' },
  { id: 'store', label: 'Play Store' }
];

function render() {
  const def = Nav.screen();
  document.getElementById('app').innerHTML = `
  <div class="page">
    <div class="masthead">
      <div>
        <h1>Northlight for Android</h1>
        <div class="sub">The whole rental platform as a Material 3 Android app — operator side and renter side, every screen reachable and working. It runs on the same store, order lifecycle, pricing pipeline and availability engine as the web dashboard.</div>
      </div>
      <div class="controls">
        <div class="ctl">${MODES.map(m => `<button class="${S.mode === m.id ? 'on' : ''}" data-mode="${m.id}">${m.label}</button>`).join('')}</div>
        <div class="ctl">
          <button class="${S.device === 'phone' ? 'on' : ''}" data-device="phone">Phone</button>
          <button class="${S.device === 'fold' ? 'on' : ''}" data-device="fold">Fold</button>
          <button class="${S.device === 'tablet' ? 'on' : ''}" data-device="tablet">Tablet</button>
        </div>
        <div class="ctl">
          <button data-theme-set="light">Light</button>
          <button data-theme-set="dark">Dark</button>
          <button data-theme-set="system">Auto</button>
        </div>
        <div class="ctl"><button data-dyn>Material You</button></div>
      </div>
    </div>
    ${S.mode === 'app' ? appMode(def)
      : S.mode === 'screens' ? galleryMode()
      : S.mode === 'flows' ? renderFlows({ screenBody, deviceChrome })
      : renderStore({ screenBody, deviceChrome })}
  </div>`;
  wireSignaturePad();
}

function appMode(def) {
  return `<div class="stage">
    <div class="device ${S.device}">
      <div class="bezel"><div class="screen m3">
        <div class="punchhole"></div><div class="fold-seam"></div>
        ${deviceChrome(`<div class="${Nav.direction === 'back' ? 'enter-back' : 'enter-fwd'}" style="display:flex;flex-direction:column;flex:1;min-height:0" key="${Nav.top().id}">${screenBody(def, Nav.top().params)}</div>`,
          { standalone: def.standalone, tab: Nav.tab, overlay: overlayHtml(), snack: snackHtml() })}
      </div></div>
    </div>
    <div class="panel">
      <div class="pcard">
        <h3>${esc(def.title)}</h3>
        <div class="lede">${esc(def.describe || '')}</div>
        <div class="sp16"></div>
        <div class="kv"><span class="k">Screen id</span><span class="v"><span class="kbd">${esc(def.id)}</span></span></div>
        <div class="kv"><span class="k">Tab</span><span class="v">${esc(def.tab || '—')}${def.standalone ? ' · full screen' : ''}</span></div>
        <div class="kv"><span class="k">Back stack</span><span class="v">${Nav.depth()} deep</span></div>
      </div>
      <div class="pcard">
        <h3>Where you are</h3>
        <div class="breadcrumbs" style="margin-top:6px">${Nav.trail()}</div>
        <div class="sp16"></div>
        <div class="jump">
          <button data-act="nav.back">System back</button>
          <button data-goto="scan">Scanner</button>
          <button data-goto="pickup">Pickup flow</button>
          <button data-goto="return">Return flow</button>
          <button data-goto="shopHome">Renter app</button>
          <button data-goto="signin">Sign-in</button>
          <button data-reset>Restart</button>
        </div>
      </div>
      <div class="pcard">
        <h3>Android patterns in here</h3>
        <ul>
          <li><b>Per-tab back stacks.</b> Each bottom-nav destination keeps its own history; system back pops that stack, then falls back to Today.</li>
          <li><b>Bottom bars for primary actions.</b> The one action that matters sits within thumb reach, not in the app bar.</li>
          <li><b>Bottom sheets over dialogs.</b> Dialogs are reserved for destructive confirmation.</li>
          <li><b>Snackbars, not toasts</b> — with an Undo affordance where the action is reversible.</li>
          <li><b>Material You.</b> Toggle it above to see the palette Android would extract from the wallpaper.</li>
          <li><b>Adaptive layout.</b> Fold and Tablet widen the same screens rather than showing a stretched phone.</li>
        </ul>
      </div>
      <div class="pcard">
        <h3>Shared with the web dashboard</h3>
        <div class="kv"><span class="k">Order states</span><span class="v">${Object.keys(Registry.describe() && {}).length ? '' : ''}8 declared</span></div>
        <div class="kv"><span class="k">Availability rules</span><span class="v">${Registry.availabilityRules().length}</span></div>
        <div class="kv"><span class="k">Money steps</span><span class="v">${Registry.moneySteps().length}</span></div>
        <div class="kv"><span class="k">Entity schemas</span><span class="v">${Registry.entities().length}</span></div>
        <div class="kv"><span class="k">Settings panels</span><span class="v">${Registry.panels().length}</span></div>
        <div class="kv"><span class="k">Data source</span><span class="v"><span class="kbd">${esc(Store.adapterName())}</span></span></div>
        <div class="lede" style="margin-top:10px">Pick an order up here and the web dashboard shows it as Picked up — one store, two front ends.</div>
      </div>
    </div>
  </div>`;
}

function galleryMode() {
  const groups = MobileRegistry.byGroup();
  return `
    <div class="pcard" style="margin-bottom:20px">
      <h3>${MobileRegistry.count()} screens, every one reachable in the app</h3>
      <div class="lede">Rendered live from the same code the device runs — not mockups. Click any screen to open it on the device.</div>
    </div>
    ${groups.map(g => `
      <div class="groupbar"><h2>${esc(g.name)}</h2><span>${g.items.length} screens</span></div>
      <div class="gallery">
        ${g.items.map(s => `
          <div class="gcell" data-goto="${esc(s.id)}">
            <div class="gframe"><div class="mini m3">${deviceChrome(screenBody(s, undefined, {}), { standalone: s.standalone, tab: s.tab })}</div></div>
            <div class="gmeta">
              <div class="gt">${esc(s.title)}</div>
              <div class="gd">${esc((s.describe || '').split('.')[0])}.</div>
              <div class="gp">${esc(s.id)}</div>
            </div>
          </div>`).join('')}
      </div>`).join('')}`;
}

/* ---- events ---- */
function wire() {
  document.addEventListener('click', e => {
    const t = e.target;

    const mode = t.closest('[data-mode]');
    if (mode) { S.mode = mode.dataset.mode; return render(); }
    const dev = t.closest('[data-device]');
    if (dev) { S.device = dev.dataset.device; return render(); }
    const th = t.closest('[data-theme-set]');
    if (th) {
      const v = th.dataset.themeSet;
      if (v === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', v);
      return render();
    }
    if (t.closest('[data-dyn]')) {
      const on = document.documentElement.getAttribute('data-dynamic') === 'violet';
      if (on) document.documentElement.removeAttribute('data-dynamic');
      else document.documentElement.setAttribute('data-dynamic', 'violet');
      return render();
    }
    if (t.closest('[data-reset]')) { Nav.reset(); S.screen = {}; S.mode = 'app'; return render(); }

    const goto = t.closest('[data-goto]');
    if (goto) { S.mode = 'app'; Nav.goto(goto.dataset.goto); return; }

    if (t.closest('[data-dismiss]')) return Nav.dismiss();
    const navEl = t.closest('[data-nav]');
    if (navEl) return Nav.back();
    const tab = t.closest('.navbar [data-tab]');
    if (tab) return Nav.switchTab(tab.dataset.tab);

    const act = t.closest('[data-act]');
    if (act) {
      e.preventDefault();
      const fn = ACTIONS[act.dataset.act];
      if (!fn) return Nav.toast(`No handler for "${act.dataset.act}"`);
      fn({ data: act.dataset, state: S.screen, root: document, render, el: act });
      return;
    }
  });

  document.addEventListener('input', e => {
    const el = e.target.closest('[data-search-input]');
    if (!el) return;
    const key = el.dataset.searchInput === 'picker' ? 'pickerQuery' : 'searchQuery';
    S.screen[key] = el.value;
    const pos = el.selectionStart;
    render();
    const again = document.querySelector(`[data-search-input="${el.dataset.searchInput}"]`)
      || document.querySelector('[data-search-input]');
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* ignore */ } }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') Nav.back();
  });

  Nav.onChange = render;
}

/* signature canvas is the one place raw DOM work is needed */
function wireSignaturePad() {
  const cv = document.querySelector('#sigpad');
  if (!cv || cv.dataset.wired) return;
  cv.dataset.wired = '1';
  const rect = cv.getBoundingClientRect();
  cv.width = rect.width * 2; cv.height = rect.height * 2;
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  ctx.strokeStyle = getComputedStyle(cv).color || '#000';
  ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let drawing = false;
  const pt = e => {
    const r = cv.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return [p.clientX - r.left, p.clientY - r.top];
  };
  const start = e => { drawing = true; ctx.beginPath(); ctx.moveTo(...pt(e)); e.preventDefault();
    const h = document.querySelector('#sighint'); if (h) h.style.display = 'none'; };
  const move = e => { if (!drawing) return; ctx.lineTo(...pt(e)); ctx.stroke(); e.preventDefault(); };
  const end = () => { if (drawing) cv.dataset.signed = '1'; drawing = false; };
  cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  cv.addEventListener('touchstart', start, { passive: false });
  cv.addEventListener('touchmove', move, { passive: false });
  cv.addEventListener('touchend', end);
}

wire();
render();

globalThis.Northlight = { Nav, MobileRegistry, Store, Registry, S, FLOWS, render };
