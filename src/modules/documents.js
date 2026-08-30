import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { esc, D, sum, daysBetween } from '../core/util.js';
import { pageHead, tile, empty, toast, Modal, tabs, icon } from '../core/ui.js';
import { money, fmtDY, fmtT } from '../core/fields.js';
import { DataTable } from '../core/view.js';
import { orderTotals, lineTotal } from '../schema/pricing.js';
import { createDocument } from '../schema/documents.js';
import { logActivity } from './orders.js';

const LIST_COLUMNS = ['number', 'type', 'orderId', 'customer', 'status', 'date', 'amount',
  { key: 'actions', label: 'Actions', align: 'right', type: 'custom',
    render: d => `<button class="btn sm" data-act="document.preview" data-doc="${d.id}">Preview</button>` }];

Registry.module({
  id: 'documents', label: 'Documents', icon: 'documents', order: 40, group: 'Manage',
  entity: 'documents',
  badge: () => { const n = Data.documents().filter(d => d.status === 'Overdue').length; return n ? { count: n, tone: 'crit' } : null; },

  render({ tabState }) {
    const filter = tabState('documents.filter', 'all');
    /* Tabs come from the document-type registry plus one derived view. */
    const tabDefs = [
      { id: 'all', label: 'All' },
      ...Registry.documentTypes().map(t => ({ id: t.id, label: t.label + 's' })),
      { id: 'overdue', label: 'Overdue' }
    ];
    let rows = Data.documents().slice().sort((a, b) => D(b.date) - D(a.date));
    if (filter === 'overdue') rows = rows.filter(d => d.status === 'Overdue');
    else if (filter !== 'all') rows = rows.filter(d => d.type === filter);

    const unpaid = sum(Data.documents().filter(d => d.type === 'invoice'),
      d => { const o = Data.order(d.orderId); return o ? Math.max(0, orderTotals(o).due) : 0; });

    return `
    ${pageHead({
      title: 'Documents',
      sub: 'Quotes, contracts, invoices and packing slips generated from orders',
      actions: `<button class="btn" data-go="settings" data-param="documents">Templates & numbering</button>
                <button class="btn" data-act="export.csv" data-entity="documents">Export CSV</button>`
    })}
    <div class="tiles" style="margin-bottom:16px">
      ${tile('Documents', Data.documents().length, 'across all orders')}
      ${tile('Awaiting signature', Data.documents().filter(d => d.type === 'contract' && !d.signedBy).length, 'contracts sent but unsigned')}
      ${tile('Overdue invoices', Data.documents().filter(d => d.status === 'Overdue').length, 'past their due date',
        Data.documents().some(d => d.status === 'Overdue') ? 'alert' : '')}
      ${tile('Unpaid value', money(unpaid).replace(/\.00$/, ''), 'across open invoices')}
    </div>
    ${tabs(tabDefs, filter, 'documents.filter')}
    <div class="card">${DataTable({
      entity: 'documents', columns: LIST_COLUMNS, rows, rowAct: 'document.preview',
      rowData: d => ({ doc: d.id }),
      empty: empty('No documents here', 'Generate one from any order.')
    })}</div>`;
  },

  actions: {
    'document.generate': ({ data, render }) => {
      const type = Registry.documentTypeById(data.type);
      const d = createDocument(data.order, data.type);
      logActivity(data.order, `${type.label} ${d.number} generated`);
      toast(`${type.label} ${d.number} generated`);
      render();
    },
    'document.preview': ({ data }) => preview(Data.document(data.doc)),
    'document.send': ({ data, render }) => {
      const d = Data.document(data.doc);
      const o = Data.order(d.orderId);
      d.sentTo = Data.customer(o.customerId).email;
      if (d.status === 'Draft') d.status = 'Sent';
      Store.changed('documents');
      logActivity(o.id, `${d.number} sent to ${d.sentTo}`);
      Modal.close();
      toast(`${d.number} sent to ${d.sentTo}`);
      render();
    },
    'document.sign': ({ data, render }) => {
      const d = Data.document(data.doc);
      const o = Data.order(d.orderId);
      d.signedBy = Data.customer(o.customerId).contact;
      d.status = 'Signed';
      o.signature = d.signedBy;
      o.signedAt = new Date().toISOString();
      Store.changed('documents');
      logActivity(o.id, `${d.number} signed by ${d.signedBy}`);
      toast('Signature captured');
      render();
    },
    'document.print': () => window.print()
  }
});

/* One renderer for every document type; the type's flags decide what
   appears. A new type needs no new template. */
function preview(d) {
  const type = Registry.documentTypeById(d.type);
  const o = Data.order(d.orderId);
  const c = Data.customer(o.customerId);
  const t = orderTotals(o);
  const co = Data.company();
  const me = Data.me();

  Modal.open({
    title: `${type.label} ${d.number}`, sub: `Order #${o.number} · ${c.name}`, size: 'wide',
    body: `<div class="doc-preview">
      <div class="spread" style="align-items:flex-start;margin-bottom:18px">
        <div><h2>${esc(co.name)}</h2>
          <div class="dim" style="font-size:11.5px;line-height:1.6">${esc(co.address)}<br>${esc(co.city)} ${esc(co.zip)}, ${esc(co.country)}<br>
            ${esc(co.email)} · ${esc(co.phone)}<br><span class="mono">${esc(co.vat)}</span></div></div>
        <div style="text-align:right">
          <div class="eyebrow">${esc(type.label)}</div>
          <div class="mono" style="font-size:17px;font-weight:600">${esc(d.number)}</div>
          <div class="dim" style="font-size:11.5px;margin-top:4px">Issued ${fmtDY(d.date)}<br>Order #${o.number}</div></div>
      </div>
      <div class="spread" style="align-items:flex-start;margin-bottom:14px">
        <div><div class="eyebrow">Billed to</div>
          <div style="font-weight:600;margin-top:3px">${esc(c.name)}</div>
          <div class="dim" style="font-size:11.5px;line-height:1.6">${esc(c.contact)}<br>${esc(c.address)}<br>${esc(c.city)} ${esc(c.zip)}<br>${esc(c.email)}</div></div>
        <div style="text-align:right"><div class="eyebrow">Rental period</div>
          <div class="mono" style="font-size:12px;margin-top:3px">${fmtDY(o.startsAt)} ${fmtT(o.startsAt)}<br>→ ${fmtDY(o.stopsAt)} ${fmtT(o.stopsAt)}</div>
          <div class="dim" style="font-size:11.5px;margin-top:3px">${daysBetween(o.startsAt, o.stopsAt)}-day charge · ${esc(Data.location(o.locationId).name)}</div></div>
      </div>
      <table><thead><tr><th>Item</th><th>SKU</th><th style="text-align:right">Qty</th>
        ${type.checkboxes ? '<th style="text-align:right">Checked</th>' : ''}
        ${type.showPrices ? '<th style="text-align:right">Price</th><th style="text-align:right">Total</th>' : ''}</tr></thead>
        <tbody>${o.lines.map(l => `<tr>
          <td>${esc(l.title)}${l.note ? `<div class="dim" style="font-size:11px">${esc(l.note)}</div>` : ''}</td>
          <td class="mono" style="font-size:11px">${esc(l.sku)}</td>
          <td style="text-align:right" class="num">${l.qty}</td>
          ${type.checkboxes ? '<td style="text-align:right">☐</td>' : ''}
          ${type.showPrices ? `<td style="text-align:right" class="num">${money(l.priceEach)}</td>
            <td style="text-align:right" class="num">${money(lineTotal(l, o))}</td>` : ''}
        </tr>`).join('')}</tbody></table>
      ${type.showPrices ? `<div style="display:flex;justify-content:flex-end"><div style="width:250px">
        ${t.rows.map(r => `<div class="spread" style="padding:3px 0"><span class="dim">${esc(r.label)}</span><span class="num">${money(r.amount)}</span></div>`).join('')}
        <div class="spread" style="padding:7px 0;border-top:1px solid var(--line-strong);font-weight:700"><span>Total</span><span class="num">${money(t.total)}</span></div>
        ${type.showPayments && t.paid ? `<div class="spread" style="padding:3px 0"><span class="dim">Paid</span><span class="num">−${money(t.paid)}</span></div>
          <div class="spread" style="padding:3px 0;font-weight:700;color:${t.due > 0.01 ? 'var(--crit)' : 'var(--good)'}">
            <span>${t.due > 0.01 ? 'Due' : 'Settled'}</span><span class="num">${money(Math.max(0, t.due))}</span></div>` : ''}
        ${o.deposit ? `<div class="spread" style="padding:3px 0"><span class="dim">Security deposit (held)</span><span class="num">${money(o.deposit)}</span></div>` : ''}
      </div></div>` : ''}
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:12px">
        <div class="eyebrow" style="margin-bottom:4px">Terms</div>
        <div class="dim" style="font-size:11.5px">${esc(type.terms)}</div>
      </div>
      ${type.signature ? `<div style="margin-top:18px;display:flex;gap:26px">
        <div style="flex:1"><div class="eyebrow">Signed by the renter</div>
          <div style="border-bottom:1px solid var(--line-strong);height:38px;font-family:var(--display);font-size:17px;padding-top:10px">${esc(d.signedBy || '')}</div>
          <div class="dim" style="font-size:11px;margin-top:3px">${d.signedBy ? fmtDY(o.signedAt || d.date) : 'awaiting signature'}</div></div>
        <div style="flex:1"><div class="eyebrow">For ${esc(co.name)}</div>
          <div style="border-bottom:1px solid var(--line-strong);height:38px;font-family:var(--display);font-size:17px;padding-top:10px">${esc(me.name)}</div>
          <div class="dim" style="font-size:11px;margin-top:3px">${fmtDY(d.date)}</div></div>
      </div>` : ''}
    </div>`,
    foot: `<button class="btn" data-close-modal>Close</button>
      <button class="btn" data-act="document.print">${icon('print', 14, 2)} Print</button>
      <button class="btn primary" data-act="document.send" data-doc="${d.id}">Send to ${esc(c.email)}</button>`
  });
}
