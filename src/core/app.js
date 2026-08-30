/* The shell.

   It renders chrome and routes, and it knows the name of exactly zero
   screens: navigation comes from Registry.modules(), the body comes from
   the matched module's render(), and every data-act goes through
   Registry.runAction. Adding a screen never touches this file. */

import { $, esc } from './util.js';
import { Registry } from './registry.js';
import { Store, Data } from './store.js';
import { icon, toast, Modal, avatar } from './ui.js';

/* ---- view state ---- */
export const S = {
  route: 'dashboard',
  param: null,
  device: 'desktop',
  sidebarOpen: false,
  tab: {},              // namespaced tab state: S.tab['orders.filter']
  selection: new Set(),
  query: {},            // namespaced search state
  scratch: {}           // per-screen scratch (calendar month, POS filters…)
};
export const tabState = (key, fallback) => S.tab[key] ?? fallback;
export const setTab = (key, value) => { S.tab[key] = value; render(); };
export const queryState = (key, fallback = '') => S.query[key] ?? fallback;

/* ---- routing ---- */
export function go(route, param = null) {
  S.route = route;
  S.param = param;
  S.sidebarOpen = false;
  location.hash = '#/' + route + (param ? '/' + param : '');
  window.scrollTo(0, 0);
  render();
}
function readHash() {
  const [r, p] = location.hash.replace(/^#\//, '').split('/');
  if (r) { S.route = r; S.param = p || null; }
}

/* ---- render ---- */
export function render() {
  const app = $('#app');
  if (!app) return;
  const mod = Registry.moduleById(S.route) || Registry.modules()[0];

  if (S.device !== 'desktop') {
    const device = Registry.modules().find(m => m.device === S.device);
    app.innerHTML = device ? device.render({ S }) : '';
    Modal.render();
    return;
  }

  app.innerHTML = `
  <div class="shell">
    ${sidebar(mod)}
    <div class="main">
      ${topbar()}
      <main class="content">${safeRender(mod)}</main>
    </div>
  </div>`;
  Modal.render();
}

function safeRender(mod) {
  try {
    const ctx = { S, param: S.param, go, setTab, tabState, queryState };
    return S.param && mod.detail ? mod.detail(S.param, ctx) : mod.render(ctx);
  } catch (err) {
    console.error(err);
    return `<div class="banner crit"><div><b>${esc(mod.label)} failed to render.</b> ${esc(err.message)}</div></div>`;
  }
}

function sidebar(active) {
  const groups = [];
  Registry.modules().filter(m => !m.device && m.hidden !== true).forEach(m => {
    const g = groups.find(x => x.name === (m.group || null));
    if (g) g.items.push(m); else groups.push({ name: m.group || null, items: [m] });
  });
  const company = Data.company();
  const me = Data.me();
  return `<aside class="sidebar ${S.sidebarOpen ? 'open' : ''}">
    <div class="brand">
      <div class="brand-mark">${esc(company.name[0])}</div>
      <div>
        <div class="brand-name">${esc(company.name)}</div>
        <div class="brand-sub">${esc(company.plan)} plan · ${Data.locations().length} locations</div>
      </div>
    </div>
    <button class="new-order-btn" data-act="order.new">${icon('plus', 15, 2.2)} New order</button>
    <nav class="nav">
      ${groups.map(g => `
        ${g.name ? `<div class="nav-group">${esc(g.name)}</div>` : ''}
        ${g.items.map(m => {
          const b = m.badge ? m.badge() : null;
          return `<button class="nav-item ${active.id === m.id ? 'active' : ''}" data-go="${m.id}">
            ${icon(m.icon)}<span>${esc(m.label)}</span>
            ${b ? `<span class="nav-badge ${b.tone === 'crit' ? '' : 'quiet'}">${b.count}</span>` : ''}
          </button>`;
        }).join('')}`).join('')}
    </nav>
    <div class="sidebar-foot">
      ${avatar(me.name)}
      <div class="grow" style="min-width:0">
        <div style="color:#fff;font-size:12.5px;font-weight:600" class="trunc">${esc(me.name)}</div>
        <div style="font-size:11px;color:var(--ink-text-2)">${esc(me.role)}</div>
      </div>
    </div>
  </aside>`;
}

function topbar() {
  const devices = [{ id: 'desktop', label: 'Web' }, ...Registry.modules().filter(m => m.device).map(m => ({ id: m.device, label: m.label }))];
  return `<header class="topbar">
    <button class="btn ghost menu-btn" data-act="shell.menu" aria-label="Menu">${icon('menu', 18, 2)}</button>
    <div class="search">${icon('search', 15, 2)}
      <input type="search" placeholder="Search orders, customers, products, barcodes…" value="${esc(S.query.global || '')}" data-search="global" aria-label="Global search">
    </div>
    <div class="grow"></div>
    <select class="btn sm" data-act="shell.location" style="max-width:170px" aria-label="Location">
      ${Data.locations().map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}
    </select>
    <div class="btn-group" role="group" aria-label="Device view">
      ${devices.map(d => `<button class="${S.device === d.id ? 'on' : ''}" data-device="${d.id}">${esc(d.label)}</button>`).join('')}
    </div>
    <button class="btn ghost" data-act="shell.theme" title="Toggle theme" aria-label="Toggle theme">◐</button>
  </header>`;
}

/* ---- one delegated listener set, bound once ---- */
let wired = false;
export function bindEvents() {
  if (wired) return;
  wired = true;

  document.addEventListener('click', e => {
    const t = e.target;

    if (t.closest('[data-close-modal]')) { e.preventDefault(); return Modal.close(); }

    const act = t.closest('[data-act]');
    if (act) {
      e.preventDefault(); e.stopPropagation();
      const ctx = { el: act, data: act.dataset, S, go, render, toast, setTab, tabState };
      if (!Registry.runAction(act.dataset.act, ctx)) toast(`No handler registered for "${act.dataset.act}"`, 'bad');
      return;
    }

    const goEl = t.closest('[data-go]');
    if (goEl) { e.preventDefault(); return go(goEl.dataset.go, goEl.dataset.param || null); }

    const tab = t.closest('[data-tab]');
    if (tab) { S.tab[tab.dataset.tab] = tab.dataset.tabValue; return render(); }

    const dev = t.closest('[data-device]');
    if (dev) { S.device = dev.dataset.device; S.scratch.posOrder = null; S.scratch.posScan = false; return render(); }

    const all = t.closest('[data-select-all]');
    if (all) { Registry.fire('select-all', { checked: all.checked, S }); return render(); }
    const row = t.closest('[data-select-row]');
    if (row) {
      row.checked ? S.selection.add(row.dataset.selectRow) : S.selection.delete(row.dataset.selectRow);
      return render();
    }

    /* Unbound switches are still interactive so settings toggles feel live. */
    const sw = t.closest('.switch');
    if (sw && !sw.dataset.fieldKey) {
      sw.classList.toggle('on');
      sw.setAttribute('aria-pressed', sw.classList.contains('on'));
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;

    const search = t.closest('[data-search]');
    if (search) {
      S.query[search.dataset.search] = t.value;
      const pos = t.selectionStart;
      render();
      const again = document.querySelector(`[data-search="${search.dataset.search}"]`);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* type has no selection */ } }
      return;
    }

    const field = t.closest('[data-field-key]');
    if (field && !field.dataset.fieldToggle) {
      Registry.fire('field-input', { key: field.dataset.fieldKey, scope: field.dataset.fieldScope, value: t.value, el: t, S });
    }
  });

  document.addEventListener('click', e => {
    const toggle = e.target.closest('[data-field-toggle]');
    if (!toggle) return;
    Registry.fire('field-input', {
      key: toggle.dataset.fieldKey, scope: toggle.dataset.fieldScope,
      value: !toggle.classList.contains('on'), el: toggle, S, toggle: true
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && Modal.isOpen()) Modal.close();
    const search = e.target.closest('[data-search="global"]');
    if (search && e.key === 'Enter') Registry.fire('global-search', { query: e.target.value, go, toast, S });
  });

  window.addEventListener('hashchange', () => {
    const before = S.route + '/' + S.param;
    readHash();
    if (before !== S.route + '/' + S.param) render();
  });

  Store.subscribe(() => { /* views re-render explicitly; hook is here for adapters that push */ });
}

export function boot() {
  readHash();
  bindEvents();
  render();
}
