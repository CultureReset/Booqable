/* Presentational primitives. Every screen composes these instead of
   hand-writing markup, so a change here lands everywhere at once. */

import { esc, initials } from './util.js';

export const ICONS = {
  dashboard: '<path d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z"/>',
  orders: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  documents: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
  customers: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.4a3.2 3.2 0 010 5.2M18 19.5c0-2.6-1-4.2-2.5-5.2"/>',
  products: '<path d="M12 2.6l8.5 4.7v9.4L12 21.4 3.5 16.7V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.4"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>',
  store: '<path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9"/><path d="M8 20v-6h8v6"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  blueprint: '<path d="M3 5.5h18v13H3z"/><path d="M8 5.5v13M3 11h5M13 8.5h6M13 15h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  scan: '<path d="M3 8V5a2 2 0 012-2h3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3M3 12h18"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.5 9.5c0-1-1.1-1.8-2.5-1.8S9.5 8.5 9.5 9.6c0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.5 1.9s-2.5-.8-2.5-1.9"/>'
};
export const icon = (n, size = 16, sw = 1.7) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

export const chip = (label, tone = 'plain', dot = true) =>
  `<span class="chip ${tone}">${dot ? '<span class="dot"></span>' : ''}${esc(label)}</span>`;
export const tag = label => `<span class="tag">${esc(label)}</span>`;
export const avatar = (name, size) =>
  `<div class="avatar"${size ? ` style="width:${size}px;height:${size}px;font-size:${Math.round(size / 2.9)}px"` : ''}>${esc(initials(name))}</div>`;
export const banner = (tone, html) => `<div class="banner ${tone}"><div>${html}</div></div>`;

export const tile = (k, v, m = '', cls = '') =>
  `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(String(v))}</div>${m ? `<div class="m">${m}</div>` : ''}</div>`;
export const tiles = list => `<div class="tiles">${list.map(t => tile(t.k, t.v, t.m, t.cls)).join('')}</div>`;

export const card = ({ title, sub, head = '', body, tight = false, style = '' }) => `
  <div class="card"${style ? ` style="${style}"` : ''}>
    ${title ? `<div class="card-head"><div><h3>${esc(title)}</h3>${sub ? `<div class="dim" style="font-size:12px;margin-top:2px">${esc(sub)}</div>` : ''}</div>${head}</div>` : ''}
    <div class="card-body${tight ? ' tight' : ''}">${body}</div>
  </div>`;

export const empty = (title, hint = '') =>
  `<div class="empty"><div class="big">${esc(title)}</div>${esc(hint)}</div>`;

export const pageHead = ({ title, sub, actions = '' }) => `
  <div class="page-head">
    <div><h1 class="page-title">${esc(title)}</h1>${sub ? `<div class="page-sub">${sub}</div>` : ''}</div>
    ${actions ? `<div class="row">${actions}</div>` : ''}
  </div>`;

/* Tabs are data — id, label, optional count — and emit a single data-key
   attribute the shell turns back into a state change. */
export const tabs = (items, active, key) => `
  <div class="tabs">${items.map(t => `
    <button class="${active === t.id ? 'on' : ''}" data-tab="${esc(key)}" data-tab-value="${esc(t.id)}">
      ${esc(t.label)}${t.count !== undefined ? `<span class="count">${t.count}</span>` : ''}
    </button>`).join('')}</div>`;

export const pills = (items, active, key) => `
  <div class="subtabs">${items.map(t => `
    <button class="${active === t.id ? 'on' : ''}" data-tab="${esc(key)}" data-tab-value="${esc(t.id)}">${esc(t.label)}</button>`).join('')}</div>`;

export const btn = ({ label, act, go, param, cls = '', icon: ic, data = {}, disabled }) => {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="btn ${cls}"${act ? ` data-act="${esc(act)}"` : ''}${go ? ` data-go="${esc(go)}"` : ''}${param ? ` data-param="${esc(param)}"` : ''}${attrs}${disabled ? ' disabled' : ''}>${ic ? icon(ic, 15, 2) : ''}${esc(label)}</button>`;
};

/* ---- toast ---- */
export function toast(msg, kind = 'ok') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="${kind}">${icon(kind === 'ok' ? 'check' : 'close', 15, 2.2)}</span><span>${esc(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 2600);
}

/* ---- modal ---- */
let current = null;
export const Modal = {
  open(cfg) { current = cfg; Modal.render(); },
  close() { current = null; Modal.render(); },
  isOpen: () => !!current,
  current: () => current,
  render() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    if (!current) { root.innerHTML = ''; return; }
    const m = current;
    root.innerHTML = `<div class="scrim" data-scrim>
      <div class="modal ${m.size || ''}" role="dialog" aria-modal="true" aria-label="${esc(m.title)}">
        <div class="modal-head">
          <div><h3>${esc(m.title)}</h3>${m.sub ? `<div class="sub">${esc(m.sub)}</div>` : ''}</div>
          <button class="x" data-close-modal aria-label="Close">${icon('close', 18, 2)}</button>
        </div>
        <div class="modal-body">${m.body}</div>
        ${m.foot ? `<div class="modal-foot">${m.foot}</div>` : ''}
      </div></div>`;
    root.querySelector('[data-scrim]').addEventListener('mousedown', e => {
      if (e.target === e.currentTarget) Modal.close();
    });
    if (m.onMount) m.onMount(root);
  }
};
