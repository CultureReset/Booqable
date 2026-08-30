/* Material 3 widget vocabulary.

   Every screen composes these; none writes raw markup for a component
   Android already has a name for. Keeps the whole app on one system. */

import { esc } from '../../src/core/util.js';

/* ---- Material Symbols, drawn as strokes so one set works at any weight ---- */
const P = {
  today:'<path d="M4 5.5h16v15H4z"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/><path d="M8 14h3v3H8z"/>',
  orders:'<path d="M5 3.5h10l4 4v13H5z"/><path d="M15 3.5v4h4"/><path d="M8.5 12h7M8.5 15.5h7M8.5 8.5h3"/>',
  scan:'<path d="M3 8V5.5A2.5 2.5 0 015.5 3H8M16 3h2.5A2.5 2.5 0 0121 5.5V8M21 16v2.5a2.5 2.5 0 01-2.5 2.5H16M8 21H5.5A2.5 2.5 0 013 18.5V16"/><path d="M3 12h18"/>',
  catalog:'<path d="M12 2.7l8.4 4.65v9.3L12 21.3 3.6 16.65v-9.3z"/><path d="M3.6 7.35L12 12l8.4-4.65M12 12v9.3"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>',
  back:'<path d="M20 12H4M10 6l-6 6 6 6"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  add:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="M4 12.5l5 5L20 6.5"/>',
  chevron:'<path d="M9 5l7 7-7 7"/>',
  chevdown:'<path d="M6 9l6 6 6-6"/>',
  filter:'<path d="M3 5.5h18l-7 8v6l-4 2v-8z"/>',
  sort:'<path d="M4 7h16M6 12h12M9 17h6"/>',
  calendar:'<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  person:'<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-4 3.4-6.6 7.5-6.6s7.5 2.6 7.5 6.6"/>',
  group:'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6"/><path d="M16.2 5.2a3.2 3.2 0 010 5.6M18 19.6c0-2.7-1-4.3-2.6-5.3"/>',
  doc:'<path d="M14 3H6.5v18h11V6.5z"/><path d="M14 3v3.5h3.5"/><path d="M9 12h6M9 16h4"/>',
  chart:'<path d="M4 20V10.5M10 20V4.5M16 20v-7M22 20H2"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.65 5.35l-2.1 2.1M7.45 16.55l-2.1 2.1M18.65 18.65l-2.1-2.1M7.45 7.45l-2.1-2.1"/>',
  store:'<path d="M3.5 9L5 4h14l1.5 5M3.5 9h17M4.5 9v11h15V9"/><path d="M9 20v-6h6v6"/>',
  bell:'<path d="M18 8.5a6 6 0 10-12 0c0 7-2.5 8-2.5 8h17s-2.5-1-2.5-8"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
  camera:'<path d="M3 8.5h4l1.5-2.5h7L17 8.5h4v11H3z"/><circle cx="12" cy="13.5" r="3.6"/>',
  flash:'<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  keyboard:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M6.5 13h.01M17 13h.01M9.5 13h5"/>',
  draw:'<path d="M3 20.5c3-1 4-4.5 6.5-4.5 1.5 0 1.5 2 3 2 2.5 0 3.5-3.5 8.5-3.5"/><path d="M6 13.5L16.5 3l3.5 3.5L9.5 17l-4 .5z"/>',
  card:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/>',
  cash:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.4 9.6c0-1-1.1-1.7-2.4-1.7s-2.4.7-2.4 1.8c0 2.5 4.8 1.3 4.8 3.8 0 1.1-1.1 1.8-2.4 1.8s-2.4-.7-2.4-1.8"/>',
  print:'<path d="M6.5 9V3.5h11V9M6.5 18H4v-7h16v7h-2.5M8 14h8v6.5H8z"/>',
  share:'<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/>',
  sync:'<path d="M20 11a8 8 0 10-1.5 6.5"/><path d="M20 4.5V11h-6.5"/>',
  offline:'<path d="M2 4l20 16"/><path d="M5 12.5a11 11 0 013.5-2.3M12 5c3 0 5.8 1.1 8 3M8.5 16a5 5 0 015-.8M12 20h.01"/>',
  pin:'<path d="M12 21.5s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10.5" r="2.6"/>',
  phone:'<path d="M6 3.5h4l2 5-2.5 1.5a11 11 0 004.5 4.5L15.5 12l5 2v4a2 2 0 01-2.2 2C10 19.4 4.6 14 4 5.7A2 2 0 016 3.5z"/>',
  mail:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 6.5l9 6.5 9-6.5"/>',
  edit:'<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
  del:'<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14"/>',
  warn:'<path d="M12 3.5L22 20H2z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
  truck:'<path d="M2.5 6.5h11.5v9.5H2.5z"/><path d="M14 9.5h4l3.5 3.5V16H14z"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
  box:'<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  tag:'<path d="M3 11V4h7l11 11-7 7z"/><circle cx="7" cy="8" r="1.4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.6 2.2"/>',
  refresh:'<path d="M4 11a8 8 0 0114-5"/><path d="M18 3v3.5h-3.5"/><path d="M20 13a8 8 0 01-14 5"/><path d="M6 21v-3.5h3.5"/>',
  logout:'<path d="M9.5 20H5.5A1.5 1.5 0 014 18.5v-13A1.5 1.5 0 015.5 4h4"/><path d="M15 8l4 4-4 4M19 12H9"/>',
  shield:'<path d="M12 3l7.5 3v6c0 4.6-3 8-7.5 9.5C7.5 20 4.5 16.6 4.5 12V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  key:'<circle cx="8" cy="12" r="4.2"/><path d="M12.2 12H21M18 12v3.2M15.2 12v2.4"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 114 2.2c-.9.6-1.6 1.1-1.6 2.3M12 17.2h.01"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3"/>',
  moon:'<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
  palette:'<path d="M12 21a9 9 0 110-18c5 0 9 3.4 9 7.5 0 2.5-2 4-4.5 4H15a1.8 1.8 0 00-1.3 3 1.8 1.8 0 01-1.7 3.5z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  location:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2"/><circle cx="12" cy="12" r="8"/>',
  swap:'<path d="M7 4v14M4 15l3 3 3-3"/><path d="M17 20V6M14 9l3-3 3 3"/>',
  play:'<path d="M6 4l14 8-14 8z"/>',
  star:'<path d="M12 3l2.6 5.6 6.1.8-4.5 4.3 1.2 6.1L12 16.9 6.6 19.8l1.2-6.1L3.3 9.4l6.1-.8z"/>',
  upload:'<path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 16v3.5h16V16"/>',
  eye:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
};
export const icon = (n, size = 24, sw = 1.8) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
export const hasIcon = n => !!P[n];

/* ---------- app bars ---------- */
export const appbar = ({ title, nav = 'back', actions = '', variant = 'small', subtitle = '' }) => {
  const navBtn = nav === 'none' ? '<div style="width:8px"></div>'
    : `<button class="iconbtn state" data-nav="${nav === 'menu' ? 'menu' : 'back'}" aria-label="${nav === 'menu' ? 'Open menu' : 'Back'}">${icon(nav === 'menu' ? 'menu' : 'back')}</button>`;
  if (variant === 'large') {
    return `<div class="appbar large">
      <div class="rowline">${navBtn}<div class="grow"></div>${actions}</div>
      <div class="big">${esc(title)}</div>
      ${subtitle ? `<div class="body-m on-var" style="padding:4px 16px 0">${esc(subtitle)}</div>` : ''}
    </div>`;
  }
  return `<div class="appbar ${variant}">
    ${navBtn}
    <div class="title">${esc(title)}${subtitle ? `<div class="body-s on-var" style="margin-top:-2px">${esc(subtitle)}</div>` : ''}</div>
    ${actions}
  </div>`;
};
export const iconAction = (name, act, { label, badge, on } = {}) =>
  `<button class="iconbtn state ${on ? 'on' : ''}" data-act="${esc(act)}" aria-label="${esc(label || act)}" style="position:relative">
    ${icon(name)}${badge ? `<span class="badge-dot" style="position:absolute;top:9px;right:9px;min-width:16px;height:16px;border-radius:8px;background:var(--md-error);color:var(--md-on-error);font-size:10px;font-weight:700;display:grid;place-items:center;padding:0 4px">${badge}</span>` : ''}
  </button>`;

/* ---------- structure ---------- */
export const scroll = html => `<div class="scroll">${html}</div>`;
export const sectionHeader = t => `<div class="section-h">${esc(t)}</div>`;
export const divider = (full = false) => `<div class="divider${full ? ' full' : ''}"></div>`;

export const listItem = ({ lead, headline, support, overline, trail, act, data = {}, lines = 2, square }) => {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="li state ${lines === 3 ? 'three' : lines === 2 ? 'two' : ''}"${act ? ` data-act="${esc(act)}"` : ''}${attrs}>
    ${lead ? `<span class="lead${square ? ' square' : ''}">${lead}</span>` : ''}
    <span class="body">
      ${overline ? `<span class="label-s on-var" style="display:block">${esc(overline)}</span>` : ''}
      <span class="headline trunc" style="display:block">${headline}</span>
      ${support ? `<span class="support" style="display:block">${support}</span>` : ''}
    </span>
    ${trail ? `<span class="trail">${trail}</span>` : ''}
  </button>`;
};

export const card = (inner, kind = '') => `<div class="card ${kind}">${inner}</div>`;
export const stat = (k, v, m = '', cls = '') =>
  `<div class="stat ${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(String(v))}</div>${m ? `<div class="m">${esc(m)}</div>` : ''}</div>`;

export const badge = (label, tone = 'neutral', dot = true) =>
  `<span class="badge ${tone}">${dot ? '<span class="dot"></span>' : ''}${esc(label)}</span>`;

export const btn = ({ label, kind = 'filled', act, data = {}, icon: ic, wide, disabled }) => {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="btn ${kind} state${wide ? ' wide' : ''}"${act ? ` data-act="${esc(act)}"` : ''}${attrs}${disabled ? ' disabled' : ''}>
    ${ic ? icon(ic, 18, 2) : ''}${esc(label)}</button>`;
};

export const fab = ({ label, icon: ic = 'add', act, extended = true, data = {} }) => {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="fab state ${extended ? 'extended' : ''}" data-act="${esc(act)}"${attrs} aria-label="${esc(label)}">
    ${icon(ic, 24, 2)}${extended ? esc(label) : ''}</button>`;
};

export const chips = (items, activeId, act, extra = {}) => {
  const attrs = Object.entries(extra).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<div class="chiprow">${items.map(i => `
    <button class="chip state ${activeId === i.id ? 'on' : ''}" data-act="${esc(act)}" data-value="${esc(i.id)}"${attrs}>
      ${activeId === i.id ? icon('check', 18, 2.2) : ''}${esc(i.label)}${i.count !== undefined ? `<span class="cnt">${i.count}</span>` : ''}
    </button>`).join('')}</div>`;
};

export const segmented = (items, activeId, act) =>
  `<div class="segmented">${items.map(i => `
    <button class="state ${activeId === i.id ? 'on' : ''}" data-act="${esc(act)}" data-value="${esc(i.id)}">
      ${activeId === i.id ? icon('check', 18, 2.2) : ''}${esc(i.label)}</button>`).join('')}</div>`;

export const searchbar = (placeholder, value = '', act = 'search.open') =>
  `<button class="searchbar state" data-act="${esc(act)}" style="width:calc(100% - 32px);text-align:left">
    ${icon('search', 22, 2)}<span class="body-l grow trunc" style="color:${value ? 'var(--md-on-surface)' : 'var(--md-on-surface-variant)'}">${esc(value || placeholder)}</span>
  </button>`;

export const textField = ({ label, value = '', type = 'text', name, supporting, outlined, rows }) => `
  <div class="tf ${outlined ? 'outlined' : ''}">
    <label>${esc(label)}</label>
    ${rows ? `<textarea data-input="${esc(name || label)}">${esc(value)}</textarea>`
      : `<input type="${type}" value="${esc(value)}" data-input="${esc(name || label)}">`}
    ${supporting ? `<div class="supporting">${esc(supporting)}</div>` : ''}
  </div>`;

export const switchRow = ({ label, support, on, act, data = {} }) => {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="li state two" ${act ? `data-act="${esc(act)}"` : ''}${attrs} style="gap:12px">
    <span class="body"><span class="headline" style="display:block">${esc(label)}</span>
    ${support ? `<span class="support" style="white-space:normal">${esc(support)}</span>` : ''}</span>
    <span class="switch ${on ? 'on' : ''}"></span>
  </button>`;
};

export const checkRow = ({ label, support, on, act, data = {}, trail = '' }) => {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="li state two" ${act ? `data-act="${esc(act)}"` : ''}${attrs}>
    <span class="checkbox ${on ? 'on' : ''}">${icon('check', 14, 3)}</span>
    <span class="body"><span class="headline" style="display:block">${esc(label)}</span>
    ${support ? `<span class="support">${esc(support)}</span>` : ''}</span>
    ${trail ? `<span class="trail">${trail}</span>` : ''}
  </button>`;
};

export const emptyState = (ic, title, body, action = '') =>
  `<div class="empty-state"><div class="icon">${icon(ic, 44, 1.5)}</div>
    <div class="t">${esc(title)}</div><div class="body-m">${esc(body)}</div>
    ${action ? `<div style="margin-top:18px">${action}</div>` : ''}</div>`;

export const banner = (tone, html, actions = '') =>
  `<div class="banner ${tone}">${icon(tone === 'info' ? 'info' : 'warn', 20, 2)}<div class="grow">${html}${actions ? `<div class="btnrow" style="margin-top:10px">${actions}</div>` : ''}</div></div>`;

export const linear = pct => `<div class="linear"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
