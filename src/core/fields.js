/* Field types.

   A field type knows three things: how to show a value, how to edit it,
   and how to flatten it for a CSV export. Tables, forms, document
   templates and exports all go through here, so a new type is available
   everywhere the moment it is registered — including types added by a
   feature module after core has loaded. */

import { Registry } from './registry.js';
import { Store } from './store.js';
import { esc, D, titleCase } from './util.js';

/* ---- shared formatters, also used directly where markup is bespoke ---- */
export const money = n => {
  const sym = Store.config('company')?.symbol ?? '$';
  return (n < 0 ? '−' : '') + sym + Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const money0 = n => (Store.config('company')?.symbol ?? '$') + Math.round(n || 0).toLocaleString('en-US');
export const fmtT = s => D(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const fmtD = s => D(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const fmtDY = s => D(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtDT = s => fmtD(s) + ' · ' + fmtT(s);
export const fmtRel = s => {
  const diff = (Date.now() - D(s)) / 36e5;
  if (diff < 1) return Math.max(1, Math.round(diff * 60)) + 'm ago';
  if (diff < 24) return Math.round(diff) + 'h ago';
  if (diff < 48) return 'Yesterday';
  return fmtDY(s);
};

const input = (f, v, attrs = '') =>
  `<input ${attrs} value="${esc(v ?? '')}" data-field-key="${esc(f.key)}"${f.readonly ? ' readonly' : ''}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>`;

/* Options may be a literal array or a function, so a select can be
   driven by live data (locations, tax profiles) without special-casing. */
export const resolveOptions = f => {
  const o = typeof f.options === 'function' ? f.options() : (f.options || []);
  return o.map(x => typeof x === 'object' ? x : { value: x, label: titleCase(x) });
};

export function registerCoreFieldTypes() {
  const t = (id, def) => Registry.fieldType(id, def);

  t('text', {
    view: v => esc(v ?? '—'),
    edit: (f, v) => input(f, v, 'type="text"'),
    parse: v => v
  });
  t('longtext', {
    view: v => esc(v ?? '—'),
    edit: (f, v) => `<textarea data-field-key="${esc(f.key)}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>${esc(v ?? '')}</textarea>`,
    parse: v => v
  });
  t('mono', {
    view: v => `<span class="mono">${esc(v ?? '—')}</span>`,
    edit: (f, v) => input(f, v, 'type="text" class="mono"'),
    parse: v => v
  });
  t('number', {
    view: v => `<span class="num">${v ?? 0}</span>`,
    edit: (f, v) => input(f, v, `type="number"${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''}${f.step ? ` step="${f.step}"` : ''}`),
    parse: v => +v || 0
  });
  t('money', {
    view: v => `<span class="num">${money(v)}</span>`,
    edit: (f, v) => input(f, v, 'type="number" step="0.01"'),
    parse: v => +v || 0,
    exportValue: v => (v ?? 0).toFixed(2)
  });
  t('percent', {
    view: v => `<span class="num">${v ?? 0}%</span>`,
    edit: (f, v) => input(f, v, 'type="number" step="0.1"'),
    parse: v => +v || 0
  });
  t('date', {
    view: v => v ? fmtDY(v) : '—',
    edit: (f, v) => input(f, v ? String(v).slice(0, 10) : '', 'type="date"'),
    parse: v => v
  });
  t('datetime', {
    view: v => v ? fmtDT(v) : '—',
    edit: (f, v) => input(f, v ? String(v).slice(0, 16) : '', 'type="datetime-local"'),
    parse: v => v ? new Date(v).toISOString() : null
  });
  t('time', {
    view: v => v ?? '—',
    edit: (f, v) => input(f, v, 'type="time"'),
    parse: v => v
  });
  t('bool', {
    view: v => v ? '<span class="chip good">Yes</span>' : '<span class="chip plain">No</span>',
    edit: (f, v) => `<button class="switch ${v ? 'on' : ''}" data-field-key="${esc(f.key)}" data-field-toggle aria-pressed="${!!v}"></button>`,
    parse: v => !!v,
    exportValue: v => v ? 'yes' : 'no'
  });
  t('select', {
    view: (v, f) => {
      const opt = resolveOptions(f).find(o => o.value === v);
      return esc(opt ? opt.label : (v ?? '—'));
    },
    edit: (f, v) => `<select data-field-key="${esc(f.key)}">${f.allowEmpty ? '<option value="">—</option>' : ''}${
      resolveOptions(f).map(o => `<option value="${esc(o.value)}"${o.value === v ? ' selected' : ''}>${esc(o.label)}</option>`).join('')
    }</select>`,
    parse: v => v
  });
  t('tags', {
    view: v => (v && v.length) ? v.map(x => `<span class="tag">${esc(x)}</span>`).join(' ') : '<span class="dim">—</span>',
    edit: (f, v) => input(f, (v || []).join(', '), 'type="text"'),
    parse: v => String(v).split(',').map(s => s.trim()).filter(Boolean),
    exportValue: v => (v || []).join('|')
  });
  t('chip', {
    view: (v, f) => {
      const tone = typeof f.tone === 'function' ? f.tone(v) : (f.tone || 'plain');
      const label = typeof f.chipLabel === 'function' ? f.chipLabel(v) : (v ?? '—');
      return `<span class="chip ${tone}"><span class="dot"></span>${esc(label)}</span>`;
    },
    edit: (f, v) => Registry.getFieldType('select').edit(f, v),
    parse: v => v
  });
  /* A relation renders the related record's label and links to it. */
  t('relation', {
    view: (v, f) => {
      const rec = v && Store.get(f.entity, v);
      if (!rec) return '<span class="dim">—</span>';
      const label = f.display ? f.display(rec) : (rec.name || rec.title || rec.id);
      return f.link === false ? esc(label)
        : `<a href="#/${f.module || f.entity}/${rec.id}" data-go="${f.module || f.entity}" data-param="${rec.id}">${esc(label)}</a>`;
    },
    edit: (f, v) => `<select data-field-key="${esc(f.key)}">${f.allowEmpty ? '<option value="">—</option>' : ''}${
      Store.all(f.entity).map(r => {
        const label = f.display ? f.display(r) : (r.name || r.title || r.id);
        return `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(label)}</option>`;
      }).join('')
    }</select>`,
    parse: v => v,
    exportValue: (v, f) => {
      const rec = v && Store.get(f.entity, v);
      return rec ? (f.display ? f.display(rec) : rec.name || rec.id) : '';
    }
  });
  /* Escape hatch: a field can supply its own renderer without needing a
     new registered type. Still goes through the same pipeline. */
  t('custom', {
    view: (v, f, rec) => f.render ? f.render(rec, v) : esc(v ?? '—'),
    edit: (f, v, rec) => f.renderEdit ? f.renderEdit(rec, v) : (f.render ? f.render(rec, v) : esc(v ?? '')),
    parse: v => v
  });
}

/* Read/write a possibly-nested key like "fields.Shoot title". */
export const getValue = (rec, key) =>
  key.split('.').reduce((o, k) => (o == null ? o : o[k]), rec);
export const setValue = (rec, key, value) => {
  const parts = key.split('.');
  const last = parts.pop();
  const target = parts.reduce((o, k) => (o[k] ||= {}), rec);
  target[last] = value;
  return rec;
};

export const viewField = (f, rec) => {
  const v = f.compute ? f.compute(rec) : getValue(rec, f.key);
  return Registry.getFieldType(f.type || 'text').view(v, f, rec);
};
export const editField = (f, rec) => {
  const v = f.compute ? f.compute(rec) : getValue(rec, f.key);
  return Registry.getFieldType(f.type || 'text').edit(f, v, rec);
};
export const exportField = (f, rec) => {
  const v = f.compute ? f.compute(rec) : getValue(rec, f.key);
  const ft = Registry.getFieldType(f.type || 'text');
  if (ft.exportValue) return ft.exportValue(v, f, rec);
  return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
};
