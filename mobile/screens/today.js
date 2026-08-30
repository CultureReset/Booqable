/* The Today tab — the operator's first screen every morning. */

import { MobileRegistry, Nav } from '../core/nav.js';
import { Data, Store } from '../../src/core/store.js';
import { esc, D, sameDay, sum, uid } from '../../src/core/util.js';
import { money0, fmtT, fmtD, fmtRel } from '../../src/core/fields.js';
import { Lifecycle, isLatePickup, isLateReturn, totalItems, openOrders } from '../../src/schema/lifecycle.js';
import { orderTotals } from '../../src/schema/pricing.js';
import { orderShortages } from '../../src/schema/availability.js';
import { rangeById, RANGES, inRange } from '../../src/modules/dashboard.js';
import {
  icon, appbar, iconAction, scroll, listItem, stat, badge, chips,
  sectionHeader, divider, emptyState, banner, btn, fab, card
} from '../core/m3.js';

const unread = () => 3;

export const orderRow = (o, dir) => {
  const c = Data.customer(o.customerId);
  const late = dir === 'out' ? isLatePickup(o) : isLateReturn(o);
  const when = dir === 'out' ? o.startsAt : o.stopsAt;
  const short = orderShortages(o).length;
  const t = orderTotals(o);
  return listItem({
    lines: 3,
    lead: `<span class="label-m">${esc(fmtT(when).replace(/\s?[AP]M/i, ''))}</span>`,
    square: true,
    overline: `${dir === 'out' ? 'Out' : 'Back'} ${fmtD(when)} · ${esc(Data.location(o.locationId).code)}`,
    headline: esc(c.name),
    support: `#${o.number} · ${totalItems(o)} items${short ? ' · <span style="color:var(--md-error)">shortage</span>' : ''}${t.due > 0.01 ? ` · ${money0(t.due)} due` : ''}`,
    trail: late ? badge(dir === 'out' ? 'Late' : 'Overdue', 'canceled')
      : badge(Lifecycle.label(o.status), Lifecycle.tone(o.status)),
    act: 'order.open', data: { id: o.id }
  });
};

MobileRegistry.screen({
  id: 'today', title: 'Today', group: 'Today', order: 100, tab: 'today',
  describe: 'Pickups and returns for the chosen window, with overdue and shortage alerts above the fold. The one screen that answers "what happens today".',
  render: ({ state }) => {
    const r = rangeById(state.range || 'today');
    const pickups = Data.orders().filter(o => o.status === 'reserved' && (inRange(o.startsAt, r) || isLatePickup(o)))
      .sort((a, b) => D(a.startsAt) - D(b.startsAt));
    const returns = Data.orders().filter(o => ['started', 'mixed'].includes(o.status) && (inRange(o.stopsAt, r) || isLateReturn(o)))
      .sort((a, b) => D(a.stopsAt) - D(b.stopsAt));
    const lateRet = returns.filter(isLateReturn).length;
    const latePick = pickups.filter(isLatePickup).length;
    const shortages = openOrders().filter(o => orderShortages(o).length).length;
    const due = sum(Data.orders().filter(o => !['canceled', 'concept', 'archived'].includes(o.status)), o => Math.max(0, orderTotals(o).due));

    return `
    ${appbar({
      title: 'Today', nav: 'none', variant: 'large',
      subtitle: new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }),
      actions: iconAction('search', 'search.open', { label: 'Search' })
        + iconAction('bell', 'notifications.open', { label: 'Notifications', badge: unread() })
    })}
    ${scroll(`
      ${chips(RANGES.map(x => ({ id: x.id, label: x.label })), r.id, 'today.range')}
      <div class="statrow">
        ${stat('Out', pickups.length, `${latePick} past due`, latePick ? 'alert' : '')}
        ${stat('Back', returns.length, `${lateRet} overdue`, lateRet ? 'alert' : '')}
        ${stat('Owed', money0(due), 'across open orders')}
      </div>
      <div class="sp16"></div>
      ${lateRet ? banner('', `<b>${lateRet} overdue return${lateRet > 1 ? 's' : ''}.</b> Equipment is still out past the agreed time.`,
        btn({ label: 'Show overdue', kind: 'tonal', act: 'today.showLate' })) : ''}
      ${shortages ? banner('warn', `<b>${shortages} order${shortages > 1 ? 's have' : ' has'} a stock shortage</b> for its dates.`) : ''}

      ${sectionHeader(`Pickups · ${pickups.length}`)}
      ${pickups.length ? pickups.map(o => orderRow(o, 'out')).join(divider())
        : emptyState('box', 'Nothing goes out', 'No reserved orders start in this window.')}
      ${divider(true)}
      ${sectionHeader(`Returns · ${returns.length}`)}
      ${returns.length ? returns.map(o => orderRow(o, 'in')).join(divider())
        : emptyState('truck', 'Nothing comes back', 'No orders are due back in this window.')}
      ${divider(true)}
      ${sectionHeader('Notes for the crew')}
      ${Data.notes().filter(n => n.target === 'day').map(n => `
        <div style="padding:4px 16px 12px"><div class="card filled card-pad">
          <div class="body-m" style="line-height:1.55">${esc(n.body)}</div>
          <div class="body-s on-var" style="margin-top:8px">${esc(n.by)} · ${fmtRel(n.when)}</div>
        </div></div>`).join('')}
      <div style="padding:0 16px">${btn({ label: 'Add a note', kind: 'outlined', wide: true, icon: 'add', act: 'today.addNote' })}</div>
      <div class="sp88"></div>
    `)}
    ${fab({ label: 'New order', icon: 'add', act: 'order.new' })}`;
  }
});

MobileRegistry.screen({
  id: 'notifications', title: 'Notifications', group: 'Today', order: 110, tab: 'today',
  describe: 'Push inbox. Overdue returns, new store bookings and payment events, grouped by day and swipe-dismissable.',
  render: () => {
    const items = [
      ['warn', 'Overdue return', 'Public Radio KNWL · #1052 is 1 day late', '2h ago', true],
      ['info', 'New online booking', 'Cascade Weddings booked #1053 · $362.34', '5h ago', true],
      ['ok', 'Payment received', 'Harbor Films paid $2,100.00 by card', 'Yesterday', true],
      ['neutral', 'Contract signed', 'Renée Duval signed C-1189', 'Yesterday', false],
      ['neutral', 'Stock flagged', 'LIT-APS60-002 sent to the bench by Sasha', '2 days ago', false]
    ];
    return `
    ${appbar({
      title: 'Notifications', nav: 'back',
      actions: iconAction('check', 'notifications.readAll', { label: 'Mark all read' })
        + iconAction('settings', 'notifications.settings', { label: 'Notification settings' })
    })}
    ${scroll(`
      ${sectionHeader('New')}
      ${items.filter(i => i[4]).map(([tone, title, body, when]) => listItem({
        lines: 3, lead: icon(tone === 'warn' ? 'warn' : tone === 'ok' ? 'cash' : 'info', 22, 2),
        headline: esc(title), support: esc(body), trail: `<span class="body-s">${esc(when)}</span>`,
        act: 'notifications.open1'
      })).join(divider())}
      ${divider(true)}
      ${sectionHeader('Earlier')}
      ${items.filter(i => !i[4]).map(([tone, title, body, when]) => listItem({
        lines: 3, lead: icon('info', 22, 2), square: true,
        headline: esc(title), support: esc(body), trail: `<span class="body-s">${esc(when)}</span>`
      })).join(divider())}
      <div class="sp24"></div>
    `)}`;
  }
});

MobileRegistry.screen({
  id: 'search', title: 'Search', group: 'Today', order: 120, tab: 'today',
  describe: 'Full-screen search view. One field resolves order numbers, customers, products and scanned barcodes, with recents underneath.',
  render: ({ state }) => {
    const q = (state.searchQuery || '').toLowerCase();
    const orders = q ? Data.orders().filter(o => String(o.number).includes(q) || Data.customer(o.customerId).name.toLowerCase().includes(q)).slice(0, 4) : [];
    const products = q ? Data.products().filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 4) : [];
    const customers = q ? Data.customers().filter(c => c.name.toLowerCase().includes(q)).slice(0, 3) : [];
    return `
    <div class="appbar" style="background:var(--md-container-high)">
      <button class="iconbtn state" data-nav="back" aria-label="Back">${icon('back')}</button>
      <input class="grow" data-search-input placeholder="Orders, customers, products…" value="${esc(state.searchQuery || '')}"
        style="border:0;background:none;outline:none;font-size:16px;color:var(--md-on-surface);min-width:0">
      <button class="iconbtn state" data-act="scan.open" aria-label="Scan">${icon('scan')}</button>
    </div>
    ${scroll(`
      ${!q ? `
        ${sectionHeader('Recent')}
        ${['#1052 Public Radio KNWL', 'Aputure LS 600d', 'Harbor Films'].map(r => listItem({
          lead: icon('clock', 22, 2), square: true, headline: esc(r), lines: 1,
          trail: icon('back', 18, 2), act: 'search.recent', data: { value: r }
        })).join('')}
        ${sectionHeader('Try scanning')}
        <div style="padding:0 16px 20px" class="body-m on-var">Point the scanner at a case label to jump straight to the order it is on.</div>
      ` : `
        ${orders.length ? sectionHeader('Orders') + orders.map(o => listItem({
          lead: `<span class="label-m mono">#${o.number}</span>`, square: true, lines: 2,
          headline: esc(Data.customer(o.customerId).name),
          support: `${fmtD(o.startsAt)} → ${fmtD(o.stopsAt)}`,
          trail: badge(Lifecycle.label(o.status), Lifecycle.tone(o.status)),
          act: 'order.open', data: { id: o.id }
        })).join('') : ''}
        ${products.length ? sectionHeader('Products') + products.map(p => listItem({
          lead: p.icon, square: true, lines: 2, headline: esc(p.name),
          support: esc(p.sku), act: 'product.open', data: { id: p.id }
        })).join('') : ''}
        ${customers.length ? sectionHeader('Customers') + customers.map(c => listItem({
          lead: esc(c.name[0]), lines: 2, headline: esc(c.name), support: esc(c.email),
          act: 'customer.open', data: { id: c.id }
        })).join('') : ''}
        ${!orders.length && !products.length && !customers.length
          ? emptyState('search', 'Nothing matched', `No orders, products or customers for “${esc(state.searchQuery)}”.`) : ''}
      `}
      <div class="sp24"></div>
    `)}`;
  }
});

export const TODAY_ACTIONS = {
  'today.range': ({ data, state, render }) => { state.range = data.value; render(); },
  'today.showLate': ({ state, render }) => { state.orderFilter = 'late'; Nav.goto('orders'); void render; },
  'today.addNote': () => Nav.sheet({
    title: 'Note for the day',
    body: `<div style="padding:0 16px">
      <div class="tf"><label>Note</label><textarea data-input="daynote" placeholder="Anything the crew needs before the doors open"></textarea></div>
      <div class="body-s on-var" style="padding:4px 4px 0">Visible to everyone on shift. Not shown to customers.</div></div>`,
    actions: [{ label: 'Cancel', kind: 'text', act: 'nav.dismiss' }, { label: 'Post note', kind: 'filled', act: 'today.saveNote' }]
  }),
  'today.saveNote': ({ root }) => {
    const el = root.querySelector('[data-input="daynote"]');
    const body = el && el.value.trim();
    if (!body) return Nav.toast('Write something first');
    Store.insert('notes', { id: uid('nt'), target: 'day', targetId: 'dash', body, by: Data.me().name, when: new Date().toISOString() });
    Nav.dismiss();
    Nav.toast('Note posted to the crew');
  },
  'notifications.open': () => Nav.push('notifications'),
  'notifications.open1': () => Nav.toast('Opening the order this notification is about'),
  'notifications.readAll': () => Nav.toast('All notifications marked read'),
  'notifications.settings': () => Nav.push('settingsPanel', { id: 'notifications' }),
  'search.open': ({ state, render }) => { state.searchQuery = ''; Nav.push('search'); void render; },
  'search.recent': ({ data, state, render }) => { state.searchQuery = String(data.value).replace(/^#\d+\s*/, ''); render(); }
};

export { sameDay };
