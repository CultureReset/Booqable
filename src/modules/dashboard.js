import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { esc, sameDay, startOfDay, addDays, D, sum, uid } from '../core/util.js';
import { icon, tile, card, empty, pageHead, toast, chip } from '../core/ui.js';
import { money0, fmtT, fmtD, fmtRel } from '../core/fields.js';
import { Lifecycle, isLate, isLatePickup, isLateReturn, totalItems, openOrders } from '../schema/lifecycle.js';
import { orderTotals } from '../schema/pricing.js';
import { orderShortages } from '../schema/availability.js';

/* Windows are data so other screens (the fulfilment report, the POS)
   reuse the same definitions instead of redefining "today". */
export const RANGES = [
  { id: 'today', label: 'Today', from: () => startOfDay(new Date()), to: () => addDays(startOfDay(new Date()), 1) },
  { id: 'tomorrow', label: 'Tomorrow', from: () => addDays(startOfDay(new Date()), 1), to: () => addDays(startOfDay(new Date()), 2) },
  { id: 'week', label: 'Next 7 days', from: () => startOfDay(new Date()), to: () => addDays(startOfDay(new Date()), 7) },
  { id: 'month', label: 'Next 30 days', from: () => startOfDay(new Date()), to: () => addDays(startOfDay(new Date()), 30) }
];
export const rangeById = id => RANGES.find(r => r.id === id) || RANGES[0];
export const inRange = (iso, r) => { const t = D(iso); return t >= r.from() && t < r.to(); };

const opRow = (o, dir) => {
  const c = Data.customer(o.customerId);
  const late = dir === 'out' ? isLatePickup(o) : isLateReturn(o);
  const when = dir === 'out' ? o.startsAt : o.stopsAt;
  const due = sameDay(D(when), new Date());
  const short = orderShortages(o).length;
  return `<div class="op ${late ? 'late' : due ? 'due' : ''}" data-go="orders" data-param="${o.id}">
    <div class="time">${fmtT(when)}<div style="font-size:10px;color:var(--text-3)">${fmtD(when)}</div></div>
    <div class="bar"></div>
    <div class="grow">
      <div class="who">${esc(c ? c.name : '—')} <span class="mono dim" style="font-weight:400">#${o.number}</span></div>
      <div class="meta">${totalItems(o)} items · ${esc(Data.location(o.locationId).code)} · ${esc(o.source)}${
        short ? ' · <span style="color:var(--crit);font-weight:600">shortage</span>' : ''}</div>
    </div>
    ${late ? chip(dir === 'out' ? 'Late pickup' : 'Overdue', 'crit') : chip(Lifecycle.label(o.status), Lifecycle.tone(o.status))}
    <span class="go">${icon('chevron', 15, 2.2)}</span>
  </div>`;
};

Registry.module({
  id: 'dashboard', label: 'Dashboard', icon: 'dashboard', order: 10,
  badge() {
    const now = new Date();
    const n = openOrders().filter(o => sameDay(D(o.startsAt), now) || sameDay(D(o.stopsAt), now)).length;
    return n ? { count: n, tone: 'quiet' } : null;
  },

  render({ tabState }) {
    const r = rangeById(tabState('dashboard.range', 'today'));
    const pickups = Data.orders()
      .filter(o => o.status === 'reserved' && (inRange(o.startsAt, r) || isLatePickup(o)))
      .sort((a, b) => D(a.startsAt) - D(b.startsAt));
    const returns = Data.orders()
      .filter(o => ['started', 'mixed'].includes(o.status) && (inRange(o.stopsAt, r) || isLateReturn(o)))
      .sort((a, b) => D(a.stopsAt) - D(b.stopsAt));

    const latePick = pickups.filter(isLatePickup).length;
    const lateRet = returns.filter(isLateReturn).length;
    const shortOrders = openOrders().filter(o => orderShortages(o).length);
    const revenue = sum(Data.orders().filter(o => !['canceled', 'concept'].includes(o.status)), o => orderTotals(o).total);
    const outstandingTotal = sum(
      Data.orders().filter(o => !['canceled', 'concept', 'archived'].includes(o.status)),
      o => Math.max(0, orderTotals(o).due));
    const dayNotes = Data.notes().filter(n => n.target === 'day');

    return `
    ${pageHead({
      title: 'Dashboard',
      sub: `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · everything going out and coming back`,
      actions: `
        <div class="btn-group">${RANGES.map(x => `<button class="${r.id === x.id ? 'on' : ''}" data-tab="dashboard.range" data-tab-value="${x.id}">${x.label}</button>`).join('')}</div>
        <button class="btn" data-act="dashboard.runReport">${icon('print', 15, 2)} Run report</button>
        <button class="btn primary" data-act="order.new">${icon('plus', 15, 2.2)} New order</button>`
    })}

    ${(lateRet || latePick || shortOrders.length) ? `<div class="stack" style="margin-bottom:16px">
      ${lateRet ? `<div class="banner crit"><div><b>${lateRet} overdue return${lateRet > 1 ? 's' : ''}.</b> Equipment is still with customers past the agreed return time — chase these before promising the stock to anyone else.</div></div>` : ''}
      ${latePick ? `<div class="banner warn"><div><b>${latePick} pickup${latePick > 1 ? 's' : ''} past due.</b> Stock is still held but the customer has not collected.</div></div>` : ''}
      ${shortOrders.length ? `<div class="banner warn"><div><b>${shortOrders.length} order${shortOrders.length > 1 ? 's have' : ' has'} a stock shortage.</b> More is booked than you own for the dates. Open the order to swap, split or raise the shortage limit.</div></div>` : ''}
    </div>` : ''}

    <div class="tiles" style="margin-bottom:16px">
      ${tile('Out today', pickups.length, `${latePick} past due`, latePick ? 'alert' : '')}
      ${tile('Back today', returns.length, `${lateRet} overdue`, lateRet ? 'alert' : '')}
      ${tile('Open orders', openOrders().length, `${Data.orders().filter(o => o.status === 'concept').length} concepts waiting`)}
      ${tile('Booked value', money0(revenue), 'all non-cancelled orders')}
      ${tile('Outstanding', money0(outstandingTotal), 'awaiting payment', outstandingTotal > 0 ? 'alert' : '')}
    </div>

    <div class="cols c2" style="margin-bottom:16px">
      ${card({ title: `Pickups`, head: '<span class="eyebrow">Going out</span>', tight: true,
        body: `<div class="oplist">${pickups.length ? pickups.map(o => opRow(o, 'out')).join('')
          : empty('Nothing goes out', 'No reserved orders start in this window.')}</div>` })}
      ${card({ title: `Returns`, head: '<span class="eyebrow">Coming back</span>', tight: true,
        body: `<div class="oplist">${returns.length ? returns.map(o => opRow(o, 'in')).join('')
          : empty('Nothing comes back', 'No orders are due back in this window.')}</div>` })}
    </div>

    <div class="cols c2">
      ${card({ title: 'Notes for the day',
        head: `<button class="btn sm" data-act="note.add" data-target="day" data-target-id="dash">${icon('plus', 13, 2.4)} Add note</button>`,
        body: dayNotes.length ? dayNotes.map(n => noteCard(n)).join('')
          : '<div class="dim" style="font-size:13px">No notes yet. Use these for anything the crew needs to know before the doors open.</div>' })}
      ${card({ title: 'Recent activity',
        head: `<button class="btn sm ghost" data-go="orders">All orders ${icon('chevron', 12, 2.4)}</button>`,
        body: `<div class="tl">${Data.activity().slice().sort((a, b) => D(b.when) - D(a.when)).slice(0, 7).map(a => {
          const o = Data.order(a.orderId);
          return `<div class="tl-item ${a.hi ? 'hi' : ''}">
            <div class="tl-when">${fmtRel(a.when)} · ${esc(a.by)}</div>
            <div class="tl-what">${esc(a.what)} ${o ? `<a href="#/orders/${o.id}" data-go="orders" data-param="${o.id}" class="mono">#${o.number}</a>` : ''}</div>
          </div>`;
        }).join('')}</div>` })}
    </div>`;
  },

  actions: {
    'dashboard.runReport': ({ setTab, go }) => { setTab('reports.tab', 'fulfillment'); go('reports'); },
    'note.add': ({ data, render }) => {
      const body = prompt(data.target === 'day' ? 'Note for the day' : 'Note');
      if (!body) return;
      Store.insert('notes', {
        id: uid('nt'), target: data.target, targetId: data.targetId,
        body, by: Data.me().name, when: new Date().toISOString()
      });
      toast('Note added');
      render();
    }
  }
});

export const noteCard = n =>
  `<div class="note">${esc(n.body)}<div class="by">${esc(n.by)} · ${fmtRel(n.when)}</div></div>`;
