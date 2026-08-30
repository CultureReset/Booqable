/* Schema-driven views.

   A table is a list of field descriptors plus rows. A form is a list of
   field descriptors plus a record. Neither knows what entity it is
   showing, so adding a column or a form input is a schema edit, never a
   markup edit — and the same descriptor drives the CSV export. */

import { esc } from './util.js';
import { Registry } from './registry.js';
import { viewField, editField, exportField, getValue, setValue } from './fields.js';
import { empty } from './ui.js';

/* Resolve a column spec: either a full descriptor, or "fieldKey" /
   { key, ...overrides } looked up on the entity schema. */
export function resolveFields(spec, entityId) {
  const entity = entityId ? Registry.getEntity(entityId) : null;
  return spec.map(c => {
    if (typeof c === 'string') {
      const f = entity?.fields.find(x => x.key === c);
      if (!f) throw new Error(`Unknown field "${c}" on entity "${entityId}"`);
      return f;
    }
    if (c.key && entity) {
      const base = entity.fields.find(x => x.key === c.key);
      return base ? { ...base, ...c } : c;
    }
    return c;
  });
}

export function DataTable({ columns, rows, entity, rowGo, rowAct, rowData, empty: emptyState, select, className = '' }) {
  const cols = resolveFields(columns, entity);
  const head = `<tr>
    ${select ? `<th style="width:32px"><input type="checkbox" data-select-all aria-label="Select all"></th>` : ''}
    ${cols.map(c => `<th class="${c.align === 'right' ? 'r' : ''}"${c.width ? ` style="width:${c.width}"` : ''}>${esc(c.short || c.label)}</th>`).join('')}
  </tr>`;

  const body = rows.length ? rows.map(r => {
    const attrs = [
      rowGo ? ` data-go="${esc(rowGo)}" data-param="${esc(r.id)}"` : '',
      rowAct ? ` data-act="${esc(rowAct)}"` : '',
      ...Object.entries(rowData ? rowData(r) : {}).map(([k, v]) => ` data-${k}="${esc(v)}"`)
    ].join('');
    return `<tr class="${rowGo || rowAct ? '' : 'norow'}"${attrs}>
      ${select ? `<td onclick="event.stopPropagation()"><input type="checkbox" data-select-row="${esc(r.id)}"${select.has(r.id) ? ' checked' : ''} aria-label="Select row"></td>` : ''}
      ${cols.map(c => `<td class="${c.align === 'right' ? 'r' : ''}"${c.cellStyle ? ` style="${c.cellStyle}"` : ''}>${viewField(c, r)}</td>`).join('')}
    </tr>`;
  }).join('')
    : `<tr class="norow"><td colspan="${cols.length + (select ? 1 : 0)}">${emptyState || empty('Nothing here')}</td></tr>`;

  return `<div class="tbl-wrap"><table class="tbl ${className}"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/* A form renders grouped fields from a schema and tags every input with
   its key, so one delegated listener writes back to the record. */
export function Form({ fields, record, entity, groups, layout = 'grid2', scope = '' }) {
  const all = resolveFields(fields || Registry.getEntity(entity).fields.filter(f => f.form !== false), entity);
  const render = list => `<div class="${layout}">${list.map(f => Field(f, record, scope)).join('')}</div>`;

  if (!groups) return render(all);
  return groups.map(g => {
    const list = all.filter(f => f.group === g.id);
    if (!list.length) return '';
    return `<div class="form-group">
      ${g.label ? `<div class="eyebrow" style="margin:18px 0 8px">${esc(g.label)}</div>` : ''}
      ${render(list)}
    </div>`;
  }).join('');
}

export function Field(f, record, scope = '') {
  if (f.type === 'bool' && f.style === 'switch') {
    const v = getValue(record, f.key);
    return `<div class="switch-row">
      <button class="switch ${v ? 'on' : ''}" data-field-key="${esc(f.key)}" data-field-scope="${esc(scope)}" data-field-toggle aria-pressed="${!!v}"></button>
      <div><div class="t">${esc(f.label)}</div>${f.help ? `<div class="d">${esc(f.help)}</div>` : ''}</div>
    </div>`;
  }
  const control = editField(f, record).replace('data-field-key=', `data-field-scope="${esc(scope)}" data-field-key=`);
  return `<div class="field">
    <label>${esc(f.label)}${f.required ? ' *' : ''}</label>
    ${control}
    ${f.help ? `<span class="hint">${esc(f.help)}</span>` : ''}
  </div>`;
}

/* Read a form control's value back through its field type. */
export function applyFieldInput(record, fieldSpec, rawValue) {
  const ft = Registry.getFieldType(fieldSpec.type || 'text');
  setValue(record, fieldSpec.key, ft.parse ? ft.parse(rawValue) : rawValue);
  return record;
}

/* Definition list — the read-only counterpart of Form. */
export function FieldList(fields, record, entity) {
  return resolveFields(fields, entity).map(f =>
    `<div class="spread" style="font-size:12.5px;padding:2px 0">
      <span class="muted">${esc(f.label)}</span><span>${viewField(f, record)}</span>
    </div>`).join('');
}

/* CSV built from the very same descriptors the table uses. */
export function toCSV(columns, rows, entity) {
  const cols = resolveFields(columns, entity);
  const cell = s => /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s;
  return [
    cols.map(c => cell(c.label)).join(','),
    ...rows.map(r => cols.map(c => cell(exportField(c, r))).join(','))
  ].join('\n');
}

export function downloadCSV(filename, csv) {
  try {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  } catch { return false; }
}
