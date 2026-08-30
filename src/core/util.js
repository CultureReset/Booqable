/* Primitives shared by every module. No app knowledge lives here. */

export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const uid = p => p + '_' + Math.random().toString(36).slice(2, 9);
export const pad = (n, l = 2) => String(n).padStart(l, '0');
export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

/* ---- dates ---- */
export const D = s => s instanceof Date ? s : new Date(s);
export const startOfDay = d => { const x = D(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = d => { const x = startOfDay(d); x.setDate(x.getDate() + 1); return x; };
export const addDays = (d, n) => { const x = D(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const dkey = d => startOfDay(d).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.max(1, Math.ceil((D(b) - D(a)) / 864e5));
export const overlaps = (aFrom, aTo, bFrom, bTo) => D(aFrom) < D(bTo) && D(bFrom) < D(aTo);

/* ---- misc ---- */
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const sum = (arr, f = x => x) => arr.reduce((s, x) => s + f(x), 0);
export const groupBy = (arr, f) => arr.reduce((m, x) => { (m[f(x)] ||= []).push(x); return m; }, {});
export const unique = arr => [...new Set(arr)];
export const byKey = (arr, k = 'id') => Object.fromEntries(arr.map(x => [x[k], x]));
export const initials = name => String(name || '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
export const titleCase = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
