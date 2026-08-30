/* The Orders tab: list, detail, and the two flows that move equipment. */

import { MobileRegistry, Nav } from '../core/nav.js';
import { Data, Store } from '../../src/core/store.js';
import { esc, D, uid, daysBetween, sum } from '../../src/core/util.js';
import { money, money0, fmtD, fmtT, fmtDY, fmtDT, fmtRel } from '../../src/core/fields.js';
import {
  Lifecycle, applyTransition, deriveStatus, isLate, isLateReturn,
  totalItems, pickedItems, returnedItems
} from '../../src/schema/lifecycle.js';
import { orderTotals, lineTotal, lineUnits } from '../../src/schema/pricing.js';
import { orderShortages, availableQty, withShortages } from '../../src/schema/availability.js';
import { createDocument, documentsFor } from '../../src/schema/documents.js';
import { logActivity } from '../../src/modules/orders.js';
import {
  icon, appbar, iconAction, scroll, listItem, stat, badge, chips, btn, fab,
  sectionHeader, divider, emptyState, banner, card, checkRow, textField, linear, searchbar
} from '../core/m3.js';

const FILTERS = [
  { id: 'open', label: 'Open', match: o => Lifecycle.state(o.status).holdsStock },
  { id: 'pickup', label: 'To pick up', match: o => o.status === 'reserved' },
  { id: 'return', label: 'To return', match: o => ['started', 'mixed'].includes(o.status) },
  { id: 'late', label: 'Overdue', match: isLate },
  { id: 'concept', label: 'Concepts', match: o => o.status === 'concept' },
  { id: 'all', label: 'All', match: () => true }
];

/* ---------------------------------------------------------- LIST */
MobileRegistry.screen({
  id: 'orders', title: 'Orders', group: 'Orders', order: 200, tab: 'orders',
  describe: 'Filter chips over a single list. Each row carries the status, the money owed and whether it is late — enough to triage without opening anything.',
  render: ({ state }) => {
    const active = state.orderFilter || 'open';
    const f = FILTERS.find(x => x.id === active) || FILTERS[0];
    const rows = Data.orders().filter(f.match).sort((a, b) => D(a.startsAt) - D(b.startsAt));
    return `
    ${appbar({
      title: 'Orders', nav: 'none',
      actions: iconAction('sort', 'orders.sort', { label: 'Sort' }) + iconAction('search', 'search.open', { label: 'Search' })
    })}
    ${searchbar('Order #, customer or product')}
    ${chips(FILTERS.map(x => ({ id: x.id, label: x.label, count: Data.orders().filter(x.match).length })), active, 'orders.filter')}
    ${scroll(`
      ${rows.length ? rows.map(o => {
        const c = Data.customer(o.customerId);
        const t = orderTotals(o);
        const dir = o.status === 'reserved' ? 'out' : 'in';
        const when = dir === 'out' ? o.startsAt : o.stopsAt;
        return listItem({
          lines: 3, lead: `<span class="label-m mono">#${o.number}</span>`, square: true,
          overline: `${dir === 'out' ? 'Out' : 'Back'} ${fmtD(when)} ${fmtT(when)}`,
          headline: esc(c.name),
          support: `${totalItems(o)} items · ${money(t.total)}${t.due > 0.01 ? ` · <span style="color:var(--md-error)">${money0(t.due)} due</span>` : ' · paid'}`,
          trail: (isLate(o) ? badge(isLateReturn(o) ? 'Overdue' : 'Late', 'canceled') : badge(Lifecycle.label(o.status), Lifecycle.tone(o.status)))
            + (orderShortages(o).length ? badge('Short', 'err') : ''),
          act: 'order.open', data: { id: o.id }
        });
      }).join(divider()) : emptyState('orders', 'No orders here', 'Try a different filter.')}
      <div class="sp88"></div>
    `)}
    ${fab({ label: 'New order', act: 'order.new' })}`;
  }
});

/* -------------------------------------------------------- DETAIL */
const DETAIL_TABS = [
  { id: 'items', label: 'Items' }, { id: 'docs', label: 'Documents' },
  { id: 'money', label: 'Payments' }, { id: 'notes', label: 'Notes' }, { id: 'log', label: 'Activity' }
];

MobileRegistry.screen({
  id: 'order', title: 'Order detail', group: 'Orders', order: 210, tab: 'orders',
  describe: 'Collapsing app bar over swipeable tabs, with the one action that matters pinned to a bottom bar so it stays reachable one-handed.',
  demo: () => ({ id: 'o_3' }),
  render: ({ params, state }) => {
    const o = Data.order(params.id) || Data.orders()[0];
    withShortages(o);
    const c = Data.customer(o.customerId);
    const t = orderTotals(o);
    const tab = state.orderTab || 'items';
    const next = Lifecycle.available(o).find(x => ['reserve', 'pickup', 'return', 'archive'].includes(x.id));

    return `
    ${appbar({
      title: `#${o.number}`, nav: 'back', subtitle: esc(c.name),
      actions: iconAction('share', 'order.share', { label: 'Share' }) + iconAction('more', 'order.menu', { label: 'More' })
    })}
    ${scroll(`
      <div style="padding:0 16px 12px">
        <div class="rowc" style="flex-wrap:wrap;gap:8px">
          ${badge(Lifecycle.label(o.status), Lifecycle.tone(o.status))}
          ${isLate(o) ? badge(isLateReturn(o) ? `Overdue ${Math.ceil((Date.now() - D(o.stopsAt)) / 864e5)}d` : 'Pickup past due', 'canceled') : ''}
          ${o.tags.map(x => `<span class="badge neutral" style="padding:0 8px">${esc(x)}</span>`).join('')}
        </div>
        <div class="body-m on-var" style="margin-top:10px;line-height:1.6">
          ${fmtDY(o.startsAt)} ${fmtT(o.startsAt)} → ${fmtDY(o.stopsAt)} ${fmtT(o.stopsAt)}<br>
          ${daysBetween(o.startsAt, o.stopsAt)}-day charge · ${esc(Data.location(o.locationId).name)}
        </div>
        <div class="sp16"></div>
        <div class="rowc" style="gap:8px">
          ${stat('Total', money0(t.total), `${pickedItems(o)}/${totalItems(o)} out`)}
          ${stat('Owed', money0(Math.max(0, t.due)), t.due > 0.01 ? 'not settled' : 'settled', t.due > 0.01 ? 'alert' : '')}
        </div>
      </div>
      ${o.shortages.length ? banner(o.shortages.every(s => s.allowed) ? 'warn' : '',
        `<b>Shortage on ${o.shortages.length} line${o.shortages.length > 1 ? 's' : ''}.</b> ${esc(o.shortages[0].product.name)} is short ${o.shortages[0].gap}.`) : ''}
      ${chips(DETAIL_TABS, tab, 'order.tab', { id: o.id })}
      ${tabBody(tab, o, t, c)}
      <div class="sp88"></div>
    `)}
    ${next ? `<div style="padding:12px 16px 16px;background:var(--md-container);display:flex;gap:8px">
      ${btn({ label: next.label, kind: 'filled', wide: true, act: 'order.transition', data: { id: o.id, transition: next.id } })}
    </div>` : ''}`;
  }
});

function tabBody(tab, o, t, c) {
  if (tab === 'items') {
    return `${o.lines.map(l => {
      const p = l.productId ? Data.product(l.productId) : null;
      const avail = p ? availableQty(l.productId, o.startsAt, o.stopsAt, o.id) : null;
      const short = p && l.qty > avail && !['sales', 'service'].includes(p.type);
      return listItem({
        lines: 3, lead: p ? p.icon : icon('tag', 20, 2), square: true,
        headline: esc(l.title),
        support: `${esc(l.sku)} · ${money(l.priceEach)} × ${lineUnits(l, o)}${short ? ` · <span style="color:var(--md-error)">only ${avail} free</span>` : ''}`,
        trail: `<span class="title-m mono">${l.qty}×</span>
          ${l.returnedQty ? badge(`${l.returnedQty} back`, 'stopped', false) : l.pickedQty ? badge(`${l.pickedQty} out`, 'started', false) : ''}
          <span class="body-s">${money(lineTotal(l, o))}</span>`,
        act: 'order.line', data: { id: o.id, line: l.id }
      });
    }).join(divider())}
    ${divider(true)}
    <div style="padding:16px">
      <div class="card filled card-pad">
        ${t.rows.map(r => `<div class="spread" style="padding:4px 0"><span class="body-m on-var">${esc(r.label)}</span><span class="body-m mono">${money(r.amount)}</span></div>`).join('')}
        <div class="divider full" style="margin:8px 0"></div>
        <div class="spread"><span class="title-m">Total</span><span class="title-m mono">${money(t.total)}</span></div>
        <div class="spread" style="padding:4px 0"><span class="body-m on-var">Paid</span><span class="body-m mono">${money(t.paid)}</span></div>
        <div class="spread"><span class="title-s" style="color:${t.due > 0.01 ? 'var(--md-error)' : 'var(--md-primary)'}">${t.due > 0.01 ? 'Outstanding' : 'Settled'}</span>
          <span class="title-s mono" style="color:${t.due > 0.01 ? 'var(--md-error)' : 'var(--md-primary)'}">${money(Math.max(0, t.due))}</span></div>
        ${o.deposit ? `<div class="spread" style="padding-top:6px"><span class="body-s on-var">Deposit held separately</span><span class="body-s mono">${money(o.deposit)}</span></div>` : ''}
      </div>
      <div class="sp16"></div>
      <div class="btnrow">
        ${btn({ label: 'Add item', kind: 'outlined', icon: 'add', act: 'order.addItem', data: { id: o.id } })}
        ${btn({ label: 'Take payment', kind: 'tonal', icon: 'card', act: 'payment.open', data: { id: o.id } })}
      </div>
    </div>`;
  }

  if (tab === 'docs') {
    const docs = documentsFor(o.id);
    return `${docs.length ? docs.map(d => listItem({
      lines: 2, lead: icon('doc', 22, 2), square: true,
      headline: esc(d.number), support: `${esc(d.type)} · ${fmtDY(d.date)}${d.signedBy ? ` · signed by ${esc(d.signedBy)}` : ''}`,
      trail: badge(d.status, d.status === 'Overdue' ? 'canceled' : d.status === 'Paid' || d.status === 'Signed' ? 'stopped' : 'neutral'),
      act: 'document.open', data: { id: d.id }
    })).join(divider()) : emptyState('doc', 'No documents', 'Generate a quote, contract or invoice.')}
    <div style="padding:16px">${btn({ label: 'Generate document', kind: 'outlined', wide: true, icon: 'add', act: 'order.genDoc', data: { id: o.id } })}</div>`;
  }

  if (tab === 'money') {
    const pays = Data.payments().filter(p => p.orderId === o.id);
    return `${pays.length ? pays.map(p => listItem({
      lines: 2, lead: icon(p.method === 'Cash' ? 'cash' : 'card', 22, 2), square: true,
      headline: money(p.amount), support: `${esc(p.kind)} · ${esc(p.method)} · ${fmtDT(p.when)}`,
      trail: badge(p.status, p.status === 'Paid' ? 'stopped' : p.status === 'Authorized' ? 'reserved' : 'neutral')
    })).join(divider()) : emptyState('cash', 'Nothing collected', 'No payment has been recorded on this order.')}
    <div style="padding:16px" class="gap">
      ${btn({ label: `Take ${money(Math.max(0, t.due))} by Tap to Pay`, kind: 'filled', wide: true, icon: 'card', act: 'payment.open', data: { id: o.id }, disabled: t.due <= 0.01 })}
      ${btn({ label: 'Send a payment link', kind: 'outlined', wide: true, icon: 'mail', act: 'payment.link', data: { id: o.id } })}
    </div>`;
  }

  if (tab === 'notes') {
    const notes = Data.notes().filter(n => n.target === 'order' && n.targetId === o.id);
    return `${notes.length ? notes.map(n => `<div style="padding:8px 16px"><div class="card filled card-pad">
      <div class="body-m" style="line-height:1.55">${esc(n.body)}</div>
      <div class="body-s on-var" style="margin-top:8px">${esc(n.by)} · ${fmtRel(n.when)}</div></div></div>`).join('')
      : emptyState('edit', 'No notes', 'Internal only — the customer never sees these.')}
      <div style="padding:16px">${btn({ label: 'Add note', kind: 'outlined', wide: true, icon: 'add', act: 'order.addNote', data: { id: o.id } })}</div>`;
  }

  const log = Data.activity().filter(a => a.orderId === o.id).sort((a, b) => D(b.when) - D(a.when));
  return log.length ? log.map(a => listItem({
    lines: 2, lead: icon(a.hi ? 'check' : 'info', 20, 2), square: true,
    headline: esc(a.what), support: `${esc(a.by)} · ${fmtDT(a.when)}`
  })).join('') : emptyState('clock', 'Nothing logged', 'Actions on this order will appear here.');
}

/* -------------------------------------------------- PICKUP FLOW */
MobileRegistry.screen({
  id: 'pickup', title: 'Pick up items', group: 'Order flows', order: 220, tab: 'orders', standalone: true,
  describe: 'Step 1 of the handover: tick or scan each line. Trackable products need a specific unit, so scanning is the fast path and the checklist is the fallback.',
  demo: () => ({ id: 'o_3' }),
  render: ({ params, state }) => {
    const o = Data.order(params.id) || Data.orders().find(x => x.status === 'reserved');
    const picked = state.pickSet || (state.pickSet = new Set(o.lines.filter(l => l.pickedQty < l.qty).map(l => l.id)));
    const pending = o.lines.filter(l => l.pickedQty < l.qty);
    const done = pending.filter(l => picked.has(l.id)).length;
    return `
    ${appbar({ title: 'Pick up', nav: 'back', subtitle: `#${o.number} · ${esc(Data.customer(o.customerId).name)}`,
      actions: iconAction('scan', 'pickup.scan', { label: 'Scan an item' }) })}
    <div style="padding:0 16px 12px">
      ${linear(pending.length ? (done / pending.length) * 100 : 100)}
      <div class="body-s on-var" style="margin-top:8px">Step 1 of 2 · ${done} of ${pending.length} lines ready</div>
    </div>
    ${scroll(`
      ${banner('info', 'Scan each case label, or tick by hand. Leaving a line unticked puts the order into <b>Mixed</b> — the rest stays reserved.')}
      ${pending.map(l => {
        const p = l.productId ? Data.product(l.productId) : null;
        const units = p && p.track === 'trackable'
          ? Data.stockItems().filter(si => si.productId === p.id && si.condition !== 'maintenance').slice(0, l.qty) : [];
        return `${checkRow({
          label: l.title, support: `${l.sku} · ${l.qty - l.pickedQty} to go out`,
          on: picked.has(l.id), act: 'pickup.toggle', data: { id: o.id, line: l.id },
          trail: `<span class="title-m mono">${l.qty - l.pickedQty}×</span>`
        })}
        ${units.length ? `<div style="padding:0 16px 10px 52px" class="rowc" style="flex-wrap:wrap;gap:6px">
          ${units.map(si => `<span class="badge ${picked.has(l.id) ? 'ok' : 'neutral'}" style="font-family:var(--font-mono);font-size:11px">${esc(si.identifier)}</span>`).join(' ')}
        </div>` : ''}`;
      }).join(divider()) || emptyState('check', 'Everything is already out', 'Nothing left to hand over on this order.')}
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container)">
      ${btn({ label: `Continue to signature`, kind: 'filled', wide: true, act: 'pickup.next', data: { id: o.id }, disabled: done === 0 })}
    </div>`;
  }
});

MobileRegistry.screen({
  id: 'signature', title: 'Signature', group: 'Order flows', order: 230, tab: 'orders', standalone: true,
  describe: 'Step 2: on-glass signature. Required before pickup when the account turns that on, and stamped onto the contract.',
  demo: () => ({ id: 'o_3' }),
  render: ({ params }) => {
    const o = Data.order(params.id) || Data.orders().find(x => x.status === 'reserved');
    const c = Data.customer(o.customerId);
    return `
    ${appbar({ title: 'Signature', nav: 'back', subtitle: `#${o.number}` })}
    ${scroll(`
      <div style="padding:0 16px">
        ${linear(100)}
        <div class="body-s on-var" style="margin:8px 0 18px">Step 2 of 2 · customer signs to accept the equipment</div>
        <div class="card outlined card-pad">
          <div class="title-m">${esc(c.name)}</div>
          <div class="body-m on-var" style="margin-top:4px;line-height:1.55">
            I confirm I have received the ${totalItems(o)} items on order #${o.number} in working order, and accept the rental terms and liability for loss or damage.</div>
        </div>
        <div class="sp16"></div>
        <div style="border:2px dashed var(--md-outline);border-radius:var(--sh-md);height:190px;position:relative;background:var(--md-container-lowest)">
          <canvas id="sigpad" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>
          <div class="body-m on-var" style="position:absolute;left:0;right:0;bottom:14px;text-align:center;pointer-events:none" id="sighint">Sign above</div>
        </div>
        <div class="btnrow" style="margin-top:12px;justify-content:flex-end">
          ${btn({ label: 'Clear', kind: 'text', act: 'signature.clear' })}
        </div>
      </div>
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container)">
      ${btn({ label: 'Complete pickup', kind: 'filled', wide: true, act: 'pickup.commit', data: { id: o.id } })}
    </div>`;
  }
});

MobileRegistry.screen({
  id: 'return', title: 'Return items', group: 'Order flows', order: 240, tab: 'orders', standalone: true,
  describe: 'Return check-in: what came back, what condition it is in, and how much of the deposit to withhold. Deposit release happens here or nowhere.',
  demo: () => ({ id: 'o_1' }),
  render: ({ params, state }) => {
    const o = Data.order(params.id) || Data.orders().find(x => ['started', 'mixed'].includes(x.status));
    const back = state.retSet || (state.retSet = new Set(o.lines.filter(l => l.returnedQty < l.pickedQty).map(l => l.id)));
    const pending = o.lines.filter(l => l.returnedQty < l.pickedQty);
    const held = Data.payments().find(p => p.orderId === o.id && p.kind === 'Security deposit hold' && p.status === 'Authorized');
    return `
    ${appbar({ title: 'Return', nav: 'back', subtitle: `#${o.number} · ${esc(Data.customer(o.customerId).name)}`,
      actions: iconAction('scan', 'pickup.scan', { label: 'Scan an item' }) })}
    ${scroll(`
      ${isLateReturn(o) ? banner('', `<b>This return is overdue.</b> Due back ${fmtDY(o.stopsAt)} ${fmtT(o.stopsAt)}.`) : ''}
      ${sectionHeader('What came back')}
      ${pending.map(l => checkRow({
        label: l.title, support: `${l.sku} · ${l.pickedQty - l.returnedQty} still out`,
        on: back.has(l.id), act: 'return.toggle', data: { id: o.id, line: l.id },
        trail: `<span class="title-m mono">${l.pickedQty - l.returnedQty}×</span>`
      })).join(divider()) || emptyState('check', 'Nothing is out', 'Every item on this order is already back.')}
      ${divider(true)}
      ${sectionHeader('Condition and deposit')}
      <div style="padding:0 16px">
        ${held ? `<div class="card filled card-pad">
          <div class="spread"><span class="body-m">Deposit held</span><span class="title-m mono">${money(held.amount)}</span></div>
          <div class="body-s on-var" style="margin-top:6px">Anything you withhold is captured now; the rest is released back to the card.</div>
        </div><div class="sp16"></div>` : ''}
        ${textField({ label: 'Withhold for damage', value: '0', type: 'number', name: 'damage', outlined: true, supporting: held ? `Up to ${money(held.amount)}` : 'No deposit on this order' })}
        ${textField({ label: 'Condition note', value: '', name: 'condition', outlined: true, rows: 3, supporting: 'Photos can be attached from the order screen' })}
      </div>
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container)">
      ${btn({ label: 'Complete return', kind: 'filled', wide: true, act: 'return.commit', data: { id: o.id } })}
    </div>`;
  }
});

/* ---------------------------------------------------- NEW ORDER */
MobileRegistry.screen({
  id: 'orderNew', title: 'New order', group: 'Order flows', order: 250, tab: 'orders', standalone: true,
  describe: 'Create on the counter: customer, period, location. Saving as a concept holds nothing; reserving takes the stock off the shelf immediately.',
  render: ({ state }) => {
    const cust = state.newCustomer ? Data.customer(state.newCustomer) : null;
    return `
    ${appbar({ title: 'New order', nav: 'back', actions: iconAction('close', 'nav.back', { label: 'Discard' }) })}
    ${scroll(`
      ${sectionHeader('Customer')}
      ${cust ? listItem({
        lead: esc(cust.name[0]), lines: 2, headline: esc(cust.name), support: esc(cust.email),
        trail: icon('swap', 20, 2), act: 'orderNew.pickCustomer'
      }) : listItem({
        lead: icon('person', 22, 2), headline: 'Choose a customer', support: 'Required before reserving',
        lines: 2, trail: icon('chevron', 20, 2), act: 'orderNew.pickCustomer'
      })}
      ${divider(true)}
      ${sectionHeader('Rental period')}
      <div style="padding:0 16px">
        <div class="rowc" style="gap:12px">
          <div class="grow">${textField({ label: 'Pickup', value: '2026-08-31 09:00', name: 'starts', outlined: true })}</div>
        </div>
        <div class="rowc" style="gap:12px">
          <div class="grow">${textField({ label: 'Return', value: '2026-09-02 17:00', name: 'stops', outlined: true })}</div>
        </div>
        <div class="body-s on-var" style="padding:2px 4px 0">2-day charge · tiered pricing applies automatically</div>
      </div>
      ${divider(true)}
      ${sectionHeader('Location')}
      ${Data.locations().filter(l => l.type !== 'Inventory only').map((l, i) => listItem({
        lead: `<span class="label-m">${esc(l.code)}</span>`, square: true, lines: 2,
        headline: esc(l.name), support: esc(l.address),
        trail: `<span class="radio ${i === 0 ? 'on' : ''}"></span>`, act: 'orderNew.location', data: { value: l.id }
      })).join('')}
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container);display:flex;gap:8px">
      ${btn({ label: 'Concept', kind: 'outlined', act: 'orderNew.create', data: { mode: 'concept' } })}
      ${btn({ label: 'Create & reserve', kind: 'filled', wide: true, act: 'orderNew.create', data: { mode: 'reserved' } })}
    </div>`;
  }
});

MobileRegistry.screen({
  id: 'itemPicker', title: 'Add items', group: 'Order flows', order: 260, tab: 'orders', standalone: true,
  describe: 'Product picker showing live availability for the order\'s exact dates, so an unbookable item is visible before it is added.',
  demo: () => ({ id: 'o_3' }),
  render: ({ params, state }) => {
    const o = Data.order(params.id) || Data.orders()[0];
    const q = (state.pickerQuery || '').toLowerCase();
    const list = Data.products().filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    return `
    <div class="appbar" style="background:var(--md-container-high)">
      <button class="iconbtn state" data-nav="back">${icon('back')}</button>
      <input class="grow" data-search-input="picker" placeholder="Search the catalog…" value="${esc(state.pickerQuery || '')}"
        style="border:0;background:none;outline:none;font-size:16px;color:var(--md-on-surface);min-width:0">
      <button class="iconbtn state" data-act="scan.open">${icon('scan')}</button>
    </div>
    <div class="body-s on-var" style="padding:4px 16px 8px">Availability for ${fmtD(o.startsAt)} → ${fmtD(o.stopsAt)}</div>
    ${scroll(`
      ${list.map(p => {
        const a = availableQty(p.id, o.startsAt, o.stopsAt, o.id);
        const on = o.lines.find(l => l.productId === p.id);
        return listItem({
          lines: 2, lead: p.icon, square: true, headline: esc(p.name),
          support: `${esc(p.sku)} · ${money(p.price)}/${esc(p.period)}`,
          trail: (['rental', 'bundle'].includes(p.type)
            ? badge(`${a} free`, a <= 0 ? 'canceled' : a <= 2 ? 'started' : 'stopped', false)
            : badge(p.type, 'neutral', false)) + (on ? `<span class="body-s">${on.qty} on order</span>` : ''),
          act: 'itemPicker.add', data: { id: o.id, product: p.id }
        });
      }).join(divider())}
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container)">
      ${btn({ label: 'Done', kind: 'filled', wide: true, act: 'nav.back' })}
    </div>`;
  }
});

/* --------------------------------------------------------- ACTIONS */
export const ORDER_ACTIONS = {
  'orders.filter': ({ data, state, render }) => { state.orderFilter = data.value; render(); },
  'orders.sort': () => Nav.sheet({
    title: 'Sort orders',
    body: ['Soonest first', 'Latest first', 'Highest value', 'Most overdue']
      .map((l, i) => `<button class="li state" data-act="orders.sortPick"><span class="radio ${i === 0 ? 'on' : ''}"></span><span class="body"><span class="headline">${l}</span></span></button>`).join('')
  }),
  'orders.sortPick': () => { Nav.dismiss(); Nav.toast('Sorted'); },

  'order.open': ({ data, state, render }) => { state.orderTab = 'items'; Nav.push('order', { id: data.id }); void render; },
  'order.tab': ({ data, state, render }) => { state.orderTab = data.value; render(); },
  'order.new': () => Nav.push('orderNew'),
  'order.addItem': ({ data, state }) => { state.pickerQuery = ''; Nav.push('itemPicker', { id: data.id }); },
  'order.line': ({ data }) => {
    const o = Data.order(data.id);
    const l = o.lines.find(x => x.id === data.line);
    Nav.sheet({
      title: l.title, subtitle: `${l.sku} · ${l.qty} on this order`,
      body: `<div style="padding:0 8px">
        ${listItem({ lead: icon('add', 20, 2), square: true, headline: 'Change quantity', lines: 1, act: 'order.qty', data: { id: o.id, line: l.id } })}
        ${listItem({ lead: icon('swap', 20, 2), square: true, headline: 'Swap for another product', lines: 1, act: 'order.swap' })}
        ${listItem({ lead: icon('del', 20, 2), square: true, headline: 'Remove from order', lines: 1, act: 'order.removeLine', data: { id: o.id, line: l.id } })}
      </div>`
    });
  },
  'order.qty': () => { Nav.dismiss(); Nav.toast('Quantity editing lives on the web dashboard'); },
  'order.swap': () => { Nav.dismiss(); Nav.toast('Pick a replacement from the catalog'); },
  'order.removeLine': ({ data, render }) => {
    const o = Data.order(data.id);
    o.lines = o.lines.filter(l => l.id !== data.line);
    Store.changed('orders'); Nav.dismiss(); Nav.toast('Line removed'); render();
  },
  'order.share': ({ data }) => { void data; Nav.toast('Shared via the Android share sheet'); },
  'order.menu': ({ data }) => Nav.menu({
    items: [
      { label: 'Duplicate', icon: 'box', act: 'order.duplicate', data },
      { label: 'Generate document', icon: 'doc', act: 'order.genDoc', data },
      { label: 'Add note', icon: 'edit', act: 'order.addNote', data },
      { label: 'Open on the web', icon: 'share', act: 'order.share', data },
      { label: 'Cancel order', icon: 'close', act: 'order.cancel', data }
    ]
  }),
  'order.duplicate': () => { Nav.dismiss(); Nav.toast('Duplicated as a new concept'); },
  'order.cancel': ({ data }) => Nav.dialog({
    title: 'Cancel this order?',
    body: 'Stock is released immediately and the customer is notified. This cannot be undone from the app.',
    actions: [{ label: 'Keep it', kind: 'text', act: 'nav.dismiss' }, { label: 'Cancel order', kind: 'danger', act: 'order.cancelConfirm', data }]
  }),
  'order.cancelConfirm': ({ data, render }) => {
    const o = Data.order(data.id);
    o.status = 'canceled'; Store.changed('orders');
    logActivity(o.id, 'Canceled on the mobile app', true);
    Nav.dismiss(); Nav.toast(`#${o.number} canceled`); render();
  },
  'order.genDoc': ({ data }) => Nav.sheet({
    title: 'Generate a document',
    body: `<div style="padding:0 8px">${['quote', 'contract', 'invoice', 'packing'].map(t => listItem({
      lead: icon('doc', 20, 2), square: true, lines: 1,
      headline: t === 'packing' ? 'Packing slip' : t[0].toUpperCase() + t.slice(1),
      act: 'order.genDocPick', data: { id: data.id, type: t }
    })).join('')}</div>`
  }),
  'order.genDocPick': ({ data, render }) => {
    const d = createDocument(data.id, data.type);
    logActivity(data.id, `${d.number} generated on the mobile app`);
    Nav.dismiss(); Nav.toast(`${d.number} created`); render();
  },
  'order.addNote': ({ data }) => Nav.sheet({
    title: 'Internal note',
    body: `<div style="padding:0 16px"><div class="tf"><label>Note</label><textarea data-input="ordernote"></textarea></div></div>`,
    actions: [{ label: 'Cancel', kind: 'text', act: 'nav.dismiss' }, { label: 'Save', kind: 'filled', act: 'order.saveNote', data }]
  }),
  'order.saveNote': ({ data, root, render }) => {
    const el = root.querySelector('[data-input="ordernote"]');
    if (!el || !el.value.trim()) return Nav.toast('Write something first');
    Store.insert('notes', { id: uid('nt'), target: 'order', targetId: data.id, body: el.value.trim(), by: Data.me().name, when: new Date().toISOString() });
    Nav.dismiss(); Nav.toast('Note saved'); render();
  },

  /* lifecycle — the same declarative transitions the web app uses */
  'order.transition': ({ data, state, render }) => {
    const o = Data.order(data.id);
    const tr = Lifecycle.transitions.find(x => x.id === data.transition);
    if (tr.id === 'pickup') { state.pickSet = null; return Nav.push('pickup', { id: o.id }); }
    if (tr.id === 'return') { state.retSet = null; return Nav.push('return', { id: o.id }); }
    withShortages(o);
    const blocked = tr.guard ? tr.guard(o) : null;
    if (blocked) return Nav.toast('Blocked: ' + blocked);
    applyTransition(o, tr, { onLog: m => logActivity(o.id, m, true) });
    Nav.toast(`#${o.number} — ${Lifecycle.label(o.status).toLowerCase()}`);
    render();
  },

  'pickup.toggle': ({ data, state, render }) => {
    const s = state.pickSet;
    s.has(data.line) ? s.delete(data.line) : s.add(data.line);
    render();
  },
  'pickup.scan': () => Nav.push('scan', { mode: 'fulfil' }),
  'pickup.next': ({ data }) => Nav.push('signature', { id: data.id }),
  'signature.clear': ({ root }) => {
    const c = root.querySelector('#sigpad');
    if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); delete c.dataset.signed; }
    const h = root.querySelector('#sighint'); if (h) h.style.display = '';
  },
  'pickup.commit': ({ data, state, render }) => {
    const o = Data.order(data.id);
    let n = 0;
    o.lines.forEach(l => { if (state.pickSet?.has(l.id)) { n += l.qty - l.pickedQty; l.pickedQty = l.qty; } });
    if (!n) return Nav.toast('Nothing was ticked');
    o.signature = Data.customer(o.customerId).contact;
    o.signedAt = new Date().toISOString();
    const contract = documentsFor(o.id).find(d => d.type === 'contract');
    if (contract) { contract.signedBy = o.signature; contract.status = 'Signed'; }
    o.status = deriveStatus(o);
    Store.changed('orders');
    logActivity(o.id, `${n} items picked up on the mobile app — status ${Lifecycle.label(o.status)}`, true);
    state.pickSet = null;
    Nav.goto('order', { id: o.id });
    Nav.toast(`${n} items handed over`, 'Undo');
    render();
  },

  'return.toggle': ({ data, state, render }) => {
    const s = state.retSet;
    s.has(data.line) ? s.delete(data.line) : s.add(data.line);
    render();
  },
  'return.commit': ({ data, state, root, render }) => {
    const o = Data.order(data.id);
    let n = 0;
    o.lines.forEach(l => { if (state.retSet?.has(l.id)) { n += l.pickedQty - l.returnedQty; l.returnedQty = l.pickedQty; } });
    if (!n) return Nav.toast('Nothing was ticked');
    const damage = +(root.querySelector('[data-input="damage"]')?.value || 0);
    const note = root.querySelector('[data-input="condition"]')?.value || '';
    const hold = Data.payments().find(p => p.orderId === o.id && p.kind === 'Security deposit hold' && p.status === 'Authorized');
    if (hold) {
      if (damage > 0) { hold.status = 'Paid'; hold.amount = damage; hold.kind = 'Deposit captured (damage)'; }
      else hold.status = 'Released';
    }
    if (note) Store.insert('notes', { id: uid('nt'), target: 'order', targetId: o.id, body: 'Return note: ' + note, by: Data.me().name, when: new Date().toISOString() });
    o.status = deriveStatus(o);
    Store.changed('orders');
    logActivity(o.id, `${n} items returned on the mobile app — status ${Lifecycle.label(o.status)}`, true);
    if (damage > 0) logActivity(o.id, `${money(damage)} withheld from the deposit`);
    else if (hold) logActivity(o.id, 'Security deposit released');
    state.retSet = null;
    Nav.goto('order', { id: o.id });
    Nav.toast(damage > 0 ? `${money(damage)} withheld` : 'Returned, deposit released');
    render();
  },

  'orderNew.pickCustomer': () => Nav.sheet({
    title: 'Choose a customer',
    body: `<div style="padding:0 8px">${Data.customers().map(c => listItem({
      lead: esc(c.name[0]), lines: 2, headline: esc(c.name), support: esc(c.email),
      act: 'orderNew.setCustomer', data: { value: c.id }
    })).join('')}</div>`,
    actions: [{ label: 'New customer', kind: 'text', act: 'customer.new' }]
  }),
  'orderNew.setCustomer': ({ data, state, render }) => { state.newCustomer = data.value; Nav.dismiss(); render(); },
  'orderNew.location': () => Nav.toast('Pickup location set'),
  'orderNew.create': ({ data, state, render }) => {
    if (!state.newCustomer) return Nav.toast('Choose a customer first');
    const seq = (Store.config('orderSequence') || 1059) + 1;
    Store.setConfig('orderSequence', seq);
    const start = new Date(); start.setHours(9, 0, 0, 0);
    const stop = new Date(start); stop.setDate(stop.getDate() + 2); stop.setHours(17, 0, 0, 0);
    const o = Store.insert('orders', {
      id: uid('o'), number: seq, status: data.mode, customerId: state.newCustomer,
      source: 'Mobile POS', locationId: 'loc_pdx',
      startsAt: start.toISOString(), stopsAt: stop.toISOString(), createdAt: new Date().toISOString(),
      deposit: 0, couponId: null, lines: [], fields: {}, tags: [], signature: null, signedAt: null
    });
    logActivity(o.id, 'Order created on the mobile app');
    state.newCustomer = null;
    Nav.goto('order', { id: o.id });
    Nav.toast(`#${o.number} created`);
    render();
  },

  'itemPicker.add': ({ data, render }) => {
    const o = Data.order(data.id);
    const p = Data.product(data.product);
    const ex = o.lines.find(l => l.productId === p.id);
    if (ex) ex.qty++;
    else o.lines.push({ id: uid('ln'), kind: 'product', productId: p.id, title: p.name, sku: p.sku, qty: 1,
      priceEach: p.price, taxProfile: p.taxProfile, pickedQty: 0, returnedQty: 0, stockItemIds: [] });
    if (p.deposit && !o.deposit) o.deposit = p.deposit;
    Store.changed('orders');
    Nav.toast(`${p.name} added`);
    render();
  },

  'payment.open': ({ data }) => {
    const o = Data.order(data.id);
    const t = orderTotals(o);
    Nav.sheet({
      title: 'Take payment', subtitle: `#${o.number} · ${money(Math.max(0, t.due))} outstanding`,
      body: `<div style="padding:0 8px">
        ${listItem({ lead: icon('card', 22, 2), square: true, lines: 2, headline: 'Tap to Pay', support: 'Contactless card or phone on this device', act: 'payment.take', data: { id: o.id, method: 'Tap to Pay' } })}
        ${listItem({ lead: icon('cash', 22, 2), square: true, lines: 2, headline: 'Cash', support: 'Record what you took at the counter', act: 'payment.take', data: { id: o.id, method: 'Cash' } })}
        ${listItem({ lead: icon('mail', 22, 2), square: true, lines: 2, headline: 'Send a payment link', support: `Emails ${esc(Data.customer(o.customerId).email)}`, act: 'payment.link', data: { id: o.id } })}
      </div>`
    });
  },
  'payment.take': ({ data, render }) => {
    const o = Data.order(data.id);
    const t = orderTotals(o);
    if (t.due <= 0.01) { Nav.dismiss(); return Nav.toast('Already settled'); }
    Store.insert('payments', { id: uid('pay'), orderId: o.id, amount: t.due, method: data.method,
      kind: 'Full payment', when: new Date().toISOString(), status: 'Paid' });
    logActivity(o.id, `${money(t.due)} taken on the mobile app (${data.method})`);
    Nav.dismiss(); Nav.toast(`${money(t.due)} taken`); render();
  },
  'payment.link': ({ data, render }) => {
    const o = Data.order(data.id);
    logActivity(o.id, 'Payment link sent from the mobile app');
    Nav.dismiss(); Nav.toast(`Link sent to ${Data.customer(o.customerId).email}`); render();
  }
};

export { sum, money0, fmtDY, stat, chips, card, fab, sectionHeader };
