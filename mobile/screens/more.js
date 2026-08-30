/* The More tab and everything reachable from it:
   customers, calendar, documents, reports, storefront, settings,
   team, profile, sync and about. */

import { MobileRegistry, Nav } from '../core/nav.js';
import { Data, Store } from '../../src/core/store.js';
import { esc, D, sameDay, addDays, sum, uid } from '../../src/core/util.js';
import { money, money0, fmtD, fmtDY, fmtDT, fmtRel } from '../../src/core/fields.js';
import { Registry } from '../../src/core/registry.js';
import { Lifecycle, isLate, openOrders } from '../../src/schema/lifecycle.js';
import { orderTotals, lineTotal } from '../../src/schema/pricing.js';
import { customerStats } from '../../src/schema/entities.js';
import { availableOnDay, utilisationTone } from '../../src/schema/availability.js';
import {
  icon, appbar, iconAction, scroll, listItem, stat, badge, chips, btn, segmented,
  sectionHeader, divider, emptyState, banner, card, searchbar, switchRow, textField, linear
} from '../core/m3.js';

/* ------------------------------------------------------------ MORE */
const MENU = [
  { group: 'Manage', items: [
    ['customers', 'group', 'Customers', () => `${Data.customers().length} profiles`],
    ['calendar', 'calendar', 'Calendar', () => 'Pickups, returns and availability'],
    ['documents', 'doc', 'Documents', () => `${Data.documents().filter(d => d.status === 'Overdue').length} overdue invoices`]
  ] },
  { group: 'Insight', items: [
    ['reports', 'chart', 'Reports', () => 'Performance, fulfilment, utilisation'],
    ['storefront', 'store', 'Online store', () => 'Bookings coming in on their own']
  ] },
  { group: 'Account', items: [
    ['settings', 'settings', 'Settings', () => 'Company, pricing, documents, security'],
    ['team', 'group', 'Team', () => `${Data.users().length} members`],
    ['sync', 'sync', 'Sync & offline', () => 'All changes uploaded'],
    ['about', 'info', 'About', () => 'Version 4.12.2']
  ] }
];

MobileRegistry.screen({
  id: 'more', title: 'More', group: 'More', order: 400, tab: 'more',
  describe: 'Everything that is not a daily-use destination. Android convention: the fifth tab is a menu, not a screen with its own content.',
  render: () => {
    const me = Data.me();
    return `
    ${appbar({ title: 'More', nav: 'none', variant: 'large' })}
    ${scroll(`
      <div style="padding:0 16px 8px">
        <button class="card filled state" data-act="profile.open" style="width:100%;text-align:left;padding:16px;display:flex;gap:14px;align-items:center">
          <span style="width:52px;height:52px;border-radius:50%;background:var(--md-primary);color:var(--md-on-primary);display:grid;place-items:center;font-size:20px;font-weight:600;flex:none">${esc(me.name.split(' ').map(w => w[0]).join(''))}</span>
          <span class="grow"><span class="title-m" style="display:block">${esc(me.name)}</span>
          <span class="body-m on-var" style="display:block">${esc(me.role)} · Portland Warehouse</span></span>
          ${icon('chevron', 20, 2)}
        </button>
      </div>
      ${MENU.map(g => `${sectionHeader(g.group)}${g.items.map(([id, ic, label, sub]) => listItem({
        lead: icon(ic, 22, 2), square: true, lines: 2, headline: esc(label), support: esc(sub()),
        trail: icon('chevron', 20, 2), act: 'more.go', data: { screen: id }
      })).join('')}`).join('')}
      ${divider(true)}
      ${listItem({ lead: icon('logout', 22, 2), square: true, lines: 1, headline: 'Sign out', act: 'more.signout' })}
      <div class="sp24"></div>
    `)}`;
  }
});

/* ------------------------------------------------------- CUSTOMERS */
MobileRegistry.screen({
  id: 'customers', title: 'Customers', group: 'More', order: 410, tab: 'more',
  describe: 'Lifetime value and outstanding balance on every row, because at the counter the question is usually "do they owe us anything".',
  render: ({ state }) => {
    const q = (state.custQuery || '').toLowerCase();
    const rows = Data.customers().filter(c => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    return `
    ${appbar({ title: 'Customers', nav: 'back', actions: iconAction('add', 'customer.new', { label: 'New customer' }) })}
    ${searchbar('Name, email or number')}
    ${scroll(`
      ${rows.map(c => {
        const s = customerStats(c);
        return listItem({
          lines: 3, lead: esc(c.name.split(' ').map(w => w[0]).slice(0, 2).join('')),
          headline: esc(c.name),
          support: `${esc(c.email)} · ${s.count} order${s.count === 1 ? '' : 's'}`,
          trail: `<span class="body-m mono">${money0(s.spend)}</span>${s.due > 0.01 ? badge(`${money0(s.due)} due`, 'err', false) : ''}`,
          act: 'customer.open', data: { id: c.id }
        });
      }).join(divider())}
      <div class="sp88"></div>
    `)}`;
  }
});

MobileRegistry.screen({
  id: 'customer', title: 'Customer', group: 'More', order: 420, tab: 'more',
  describe: 'Profile with one-tap call and email, standing discount, and the rental history that decides whether to chase them.',
  demo: () => ({ id: 'c_1' }),
  render: ({ params }) => {
    const c = Data.customer(params.id) || Data.customers()[0];
    const s = customerStats(c);
    const notes = Data.notes().filter(n => n.target === 'customer' && n.targetId === c.id);
    return `
    ${appbar({ title: esc(c.name), nav: 'back', subtitle: esc(c.number),
      actions: iconAction('edit', 'customer.edit', { label: 'Edit' }) })}
    ${scroll(`
      <div style="padding:0 16px 12px" class="rowc" style="gap:8px">
        ${btn({ label: 'Call', kind: 'tonal', icon: 'phone', act: 'customer.call', data: { id: c.id } })}
        ${btn({ label: 'Email', kind: 'tonal', icon: 'mail', act: 'customer.email', data: { id: c.id } })}
        ${btn({ label: 'New order', kind: 'filled', icon: 'add', act: 'order.new' })}
      </div>
      <div class="statrow">
        ${stat('Orders', s.count, `${s.orders.filter(o => Lifecycle.state(o.status).holdsStock).length} open`)}
        ${stat('Lifetime', money0(s.spend), 'excl. concepts')}
        ${stat('Owed', money0(s.due), s.due > 0.01 ? 'chase this' : 'settled', s.due > 0.01 ? 'alert' : '')}
      </div>
      <div class="sp16"></div>
      ${c.discount || c.taxProfile === 'tp_exempt' ? `<div style="padding:0 16px 8px" class="rowc" style="gap:8px;flex-wrap:wrap">
        ${c.discount ? badge(`${c.discount}% standing discount`, 'stopped') : ''}
        ${c.taxProfile === 'tp_exempt' ? badge('Tax exempt', 'neutral') : ''}
        ${c.tags.map(t => badge(t, 'neutral', false)).join('')}
      </div>` : ''}
      ${sectionHeader('Contact')}
      ${listItem({ lead: icon('mail', 20, 2), square: true, lines: 2, headline: esc(c.email), support: 'Email', act: 'customer.email', data: { id: c.id } })}
      ${listItem({ lead: icon('phone', 20, 2), square: true, lines: 2, headline: esc(c.phone), support: 'Phone', act: 'customer.call', data: { id: c.id } })}
      ${listItem({ lead: icon('pin', 20, 2), square: true, lines: 2, headline: esc(c.address), support: `${esc(c.city)} ${esc(c.zip)}, ${esc(c.country)}` })}
      ${notes.length ? sectionHeader('Internal notes') + notes.map(n => `
        <div style="padding:4px 16px 10px"><div class="card filled card-pad">
          <div class="body-m" style="line-height:1.55">${esc(n.body)}</div>
          <div class="body-s on-var" style="margin-top:8px">${esc(n.by)} · ${fmtRel(n.when)}</div></div></div>`).join('') : ''}
      ${sectionHeader(`Order history · ${s.count}`)}
      ${s.orders.sort((a, b) => D(b.startsAt) - D(a.startsAt)).map(o => {
        const t = orderTotals(o);
        return listItem({
          lines: 3, lead: `<span class="label-m mono">#${o.number}</span>`, square: true,
          headline: `${fmtDY(o.startsAt)} → ${fmtDY(o.stopsAt)}`,
          support: `${money(t.total)}${t.due > 0.01 ? ` · ${money0(t.due)} due` : ' · paid'}`,
          trail: badge(Lifecycle.label(o.status), Lifecycle.tone(o.status)),
          act: 'order.open', data: { id: o.id }
        });
      }).join(divider()) || emptyState('orders', 'No orders yet', '')}
      <div class="sp24"></div>
    `)}`;
  }
});

/* -------------------------------------------------------- CALENDAR */
MobileRegistry.screen({
  id: 'calendar', title: 'Calendar', group: 'More', order: 430, tab: 'more',
  describe: 'Compact month grid with dot indicators, and the selected day as an agenda underneath — the pattern Android calendar apps settled on.',
  render: ({ state }) => {
    const view = state.calView || 'month';
    const sel = state.calDay ? new Date(state.calDay) : new Date();
    const month = new Date(sel.getFullYear(), sel.getMonth(), 1);
    const offset = (month.getDay() + 6) % 7;
    const cells = [...Array(42)].map((_, i) => addDays(month, i - offset));
    const evOn = d => Data.orders().filter(o => o.status !== 'canceled' && (sameDay(D(o.startsAt), d) || sameDay(D(o.stopsAt), d)));
    const dayEvents = evOn(sel);

    return `
    ${appbar({ title: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), nav: 'back',
      actions: iconAction('today', 'calendar.today', { label: 'Jump to today' }) })}
    <div style="padding:8px 16px">${segmented([{ id: 'month', label: 'Orders' }, { id: 'avail', label: 'Availability' }], view, 'calendar.view')}</div>
    ${view === 'avail' ? scroll(`
      <div class="body-s on-var" style="padding:8px 16px">Units still bookable per day, next 14 days.</div>
      <div style="overflow-x:auto;padding:0 16px 16px"><table style="border-collapse:collapse;min-width:max-content">
        <thead><tr><th style="text-align:left;padding:6px 10px 6px 0;position:sticky;left:0;background:var(--md-surface)"></th>
          ${[...Array(14)].map((_, i) => `<th class="body-s on-var" style="padding:4px 3px;font-weight:500">${addDays(new Date(), i).getDate()}</th>`).join('')}</tr></thead>
        <tbody>${Data.products().filter(p => p.type === 'rental').map(p => `<tr>
          <td class="body-s trunc" style="max-width:112px;padding:3px 10px 3px 0;position:sticky;left:0;background:var(--md-surface)">${esc(p.name)}</td>
          ${[...Array(14)].map((_, i) => {
            const a = availableOnDay(p.id, addDays(new Date(), i));
            const tone = utilisationTone(a, p.stock);
            return `<td style="padding:2px"><div style="width:26px;height:26px;border-radius:6px;display:grid;place-items:center;font-family:var(--font-mono);font-size:11px;
              background:${tone === 'short' ? 'var(--md-error-container)' : tone === 's0' ? 'var(--md-container-high)' : `color-mix(in srgb, var(--md-primary) ${{ s1: 18, s2: 36, s3: 55, s4: 75, s5: 92 }[tone] || 10}%, var(--md-container-high))`};
              color:${tone === 'short' ? 'var(--md-on-error-container)' : ['s4', 's5'].includes(tone) ? 'var(--md-on-primary)' : 'var(--md-on-surface)'}">${a}</div></td>`;
          }).join('')}</tr>`).join('')}</tbody></table></div>
    `) : `
      <div style="display:grid;grid-template-columns:repeat(7,1fr);padding:0 8px">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="body-s on-var" style="text-align:center;padding:6px 0">${d}</div>`).join('')}
        ${cells.map(d => {
          const evs = evOn(d);
          const outside = d.getMonth() !== month.getMonth();
          const isSel = sameDay(d, sel);
          const isToday = sameDay(d, new Date());
          return `<button class="state" data-act="calendar.pick" data-value="${d.toISOString()}"
            style="height:46px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:var(--sh-full);
            background:${isSel ? 'var(--md-primary)' : 'transparent'};color:${isSel ? 'var(--md-on-primary)' : outside ? 'var(--md-outline)' : 'var(--md-on-surface)'}">
            <span class="body-m" style="${isToday && !isSel ? 'font-weight:700;color:var(--md-primary)' : ''}">${d.getDate()}</span>
            <span style="display:flex;gap:2px;height:4px">${evs.slice(0, 3).map(o => `<i style="width:4px;height:4px;border-radius:2px;background:${isSel ? 'var(--md-on-primary)' : `var(--st-${Lifecycle.tone(o.status)}-fg)`}"></i>`).join('')}</span>
          </button>`;
        }).join('')}
      </div>
      ${divider(true)}
      ${sectionHeader(sel.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }))}
      ${scroll(dayEvents.length ? dayEvents.map(o => {
        const out = sameDay(D(o.startsAt), sel);
        return listItem({
          lines: 3, lead: icon(out ? 'upload' : 'truck', 20, 2), square: true,
          overline: out ? 'Going out' : 'Coming back',
          headline: esc(Data.customer(o.customerId).name),
          support: `#${o.number} · ${sum(o.lines, l => l.qty)} items`,
          trail: badge(Lifecycle.label(o.status), Lifecycle.tone(o.status)),
          act: 'order.open', data: { id: o.id }
        });
      }).join(divider()) : emptyState('calendar', 'Nothing scheduled', 'No pickups or returns on this day.'))}
    `}`;
  }
});

/* ------------------------------------------------------- DOCUMENTS */
MobileRegistry.screen({
  id: 'documents', title: 'Documents', group: 'More', order: 440, tab: 'more',
  describe: 'Quotes, contracts, invoices and packing slips, filtered by type. Mobile can view and send; it cannot edit templates.',
  render: ({ state }) => {
    const f = state.docFilter || 'all';
    const types = [{ id: 'all', label: 'All' }, ...Registry.documentTypes().map(t => ({ id: t.id, label: t.label + 's' })), { id: 'overdue', label: 'Overdue' }];
    let rows = Data.documents().slice().sort((a, b) => D(b.date) - D(a.date));
    if (f === 'overdue') rows = rows.filter(d => d.status === 'Overdue');
    else if (f !== 'all') rows = rows.filter(d => d.type === f);
    return `
    ${appbar({ title: 'Documents', nav: 'back' })}
    ${chips(types, f, 'documents.filter')}
    ${scroll(`
      ${rows.map(d => {
        const o = Data.order(d.orderId);
        return listItem({
          lines: 3, lead: icon('doc', 22, 2), square: true,
          overline: `${esc(Registry.documentTypeById(d.type)?.label || d.type)} · #${o.number}`,
          headline: esc(d.number),
          support: `${esc(Data.customer(o.customerId).name)} · ${fmtDY(d.date)}`,
          trail: badge(d.status, d.status === 'Overdue' ? 'canceled' : ['Paid', 'Signed', 'Accepted'].includes(d.status) ? 'stopped' : 'neutral'),
          act: 'document.open', data: { id: d.id }
        });
      }).join(divider()) || emptyState('doc', 'No documents', 'Generate one from an order.')}
      <div class="sp24"></div>
    `)}`;
  }
});

MobileRegistry.screen({
  id: 'document', title: 'Document', group: 'More', order: 450, tab: 'more',
  describe: 'Rendered exactly as the customer receives it, with send and sign in a bottom bar.',
  demo: () => ({ id: null }),
  render: ({ params }) => {
    const d = params.id ? Data.document(params.id) : Data.documents().find(x => x.type === 'invoice');
    const type = Registry.documentTypeById(d.type);
    const o = Data.order(d.orderId);
    const c = Data.customer(o.customerId);
    const t = orderTotals(o);
    const co = Data.company();
    return `
    ${appbar({ title: esc(d.number), nav: 'back', subtitle: esc(type.label),
      actions: iconAction('print', 'document.print', { label: 'Print' }) + iconAction('share', 'document.share', { label: 'Share' }) })}
    ${scroll(`
      <div style="padding:16px">
        <div class="card outlined" style="padding:22px;background:var(--md-container-lowest)">
          <div class="spread" style="align-items:flex-start">
            <div><div class="title-m">${esc(co.name)}</div>
              <div class="body-s on-var" style="line-height:1.55;margin-top:3px">${esc(co.address)}<br>${esc(co.city)} ${esc(co.zip)}<br>${esc(co.vat)}</div></div>
            <div style="text-align:right"><div class="label-m on-var">${esc(type.label).toUpperCase()}</div>
              <div class="title-m mono">${esc(d.number)}</div>
              <div class="body-s on-var">${fmtDY(d.date)}</div></div>
          </div>
          <div class="divider full" style="margin:16px 0"></div>
          <div class="label-m on-var">BILLED TO</div>
          <div class="body-m" style="margin-top:4px">${esc(c.name)}<br><span class="on-var">${esc(c.address)}, ${esc(c.city)}</span></div>
          <div class="divider full" style="margin:16px 0"></div>
          <div class="label-m on-var">RENTAL PERIOD</div>
          <div class="body-m mono" style="margin-top:4px">${fmtDY(o.startsAt)} → ${fmtDY(o.stopsAt)}</div>
          <div class="divider full" style="margin:16px 0"></div>
          ${o.lines.map(l => `<div class="spread" style="padding:6px 0;align-items:flex-start">
            <div class="grow"><div class="body-m">${esc(l.title)}</div><div class="body-s on-var mono">${esc(l.sku)} · ${l.qty}×</div></div>
            ${type.showPrices ? `<div class="body-m mono">${money(lineTotal(l, o))}</div>` : '<div class="body-m on-var">☐</div>'}
          </div>`).join('')}
          ${type.showPrices ? `<div class="divider full" style="margin:12px 0"></div>
            ${t.rows.map(r => `<div class="spread" style="padding:3px 0"><span class="body-s on-var">${esc(r.label)}</span><span class="body-s mono">${money(r.amount)}</span></div>`).join('')}
            <div class="spread" style="padding-top:8px"><span class="title-s">Total</span><span class="title-s mono">${money(t.total)}</span></div>` : ''}
          <div class="divider full" style="margin:16px 0"></div>
          <div class="body-s on-var" style="line-height:1.55">${esc(type.terms)}</div>
          ${type.signature ? `<div style="margin-top:20px">
            <div class="label-m on-var">SIGNED BY THE RENTER</div>
            <div style="border-bottom:1px solid var(--md-outline);height:40px;padding-top:12px;font-size:18px;font-family:var(--font)">${esc(d.signedBy || '')}</div>
            <div class="body-s on-var" style="margin-top:4px">${d.signedBy ? fmtDY(d.date) : 'awaiting signature'}</div></div>` : ''}
        </div>
      </div>
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container);display:flex;gap:8px">
      ${type.signature && !d.signedBy ? btn({ label: 'Collect signature', kind: 'outlined', act: 'document.sign', data: { id: d.id } }) : ''}
      ${btn({ label: `Send to ${esc(c.email.split('@')[0])}`, kind: 'filled', wide: true, icon: 'mail', act: 'document.send', data: { id: d.id } })}
    </div>`;
  }
});

/* --------------------------------------------------------- REPORTS */
MobileRegistry.screen({
  id: 'reports', title: 'Reports', group: 'More', order: 460, tab: 'more',
  describe: 'Read-only on mobile. The pull sheet is the one crews actually use standing in the warehouse, so it leads.',
  render: ({ state }) => {
    const tab = state.reportTab || 'pull';
    const orders = openOrders().filter(o => sameDay(D(o.startsAt), new Date()) || sameDay(D(o.stopsAt), new Date()) || isLate(o));
    const tally = {};
    orders.forEach(o => o.lines.forEach(l => { if (l.productId) tally[l.productId] = (tally[l.productId] || 0) + l.qty; }));
    const prodStats = () => {
      const m = {};
      Data.orders().filter(o => !['canceled', 'concept'].includes(o.status)).forEach(o => o.lines.forEach(l => {
        if (!l.productId) return;
        m[l.productId] = m[l.productId] || { rev: 0, qty: 0 };
        m[l.productId].rev += lineTotal(l, o); m[l.productId].qty += l.qty;
      }));
      return Object.entries(m).map(([id, v]) => ({ p: Data.product(id), ...v })).sort((a, b) => b.rev - a.rev);
    };
    const stats = prodStats();
    const max = stats[0]?.rev || 1;

    return `
    ${appbar({ title: 'Reports', nav: 'back', actions: iconAction('share', 'reports.export', { label: 'Export' }) })}
    ${chips([{ id: 'pull', label: 'Pull sheet' }, { id: 'products', label: 'Products' }, { id: 'money', label: 'Revenue' }], tab, 'reports.tab')}
    ${scroll(tab === 'pull' ? `
      <div class="body-s on-var" style="padding:4px 16px 10px">Everything that must leave or return today. Tick as you pick.</div>
      ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([pid, q]) => {
        const p = Data.product(pid);
        const on = orders.filter(o => o.lines.some(l => l.productId === pid));
        return listItem({
          lines: 3, lead: `<span class="checkbox"></span>`, square: true,
          headline: esc(p.name),
          support: `${esc(p.sku)} · ${on.map(o => '#' + o.number).join(', ')}`,
          trail: `<span class="headline-s mono">${q}</span>`,
          act: 'reports.tick'
        });
      }).join(divider()) || emptyState('box', 'Nothing to pull', 'No movements today.')}
    ` : tab === 'products' ? `
      ${stats.map(s => `<div style="padding:12px 16px">
        <div class="spread"><span class="body-m trunc grow">${esc(s.p.name)}</span><span class="body-m mono">${money0(s.rev)}</span></div>
        <div style="margin-top:6px">${linear((s.rev / max) * 100)}</div>
        <div class="body-s on-var" style="margin-top:4px">${s.qty} units out · ${esc(s.p.sku)}</div>
      </div>`).join('')}
    ` : `
      <div class="statrow" style="margin-bottom:12px">
        ${stat('Booked', money0(sum(Data.orders().filter(o => !['canceled', 'concept'].includes(o.status)), o => orderTotals(o).total)), 'all open + closed')}
        ${stat('Owed', money0(sum(Data.orders().filter(o => !['canceled', 'concept', 'archived'].includes(o.status)), o => Math.max(0, orderTotals(o).due))), 'outstanding')}
      </div>
      ${sectionHeader('Orders by status')}
      ${Object.keys(Lifecycle.states).map(s => {
        const n = Data.orders().filter(o => o.status === s).length;
        if (!n) return '';
        return `<div style="padding:8px 16px"><div class="spread">
          <span class="rowc" style="gap:8px">${badge(Lifecycle.label(s), Lifecycle.tone(s))}</span>
          <span class="body-m mono">${n}</span></div></div>`;
      }).join('')}
      ${sectionHeader('Where orders come from')}
      ${['Back office', 'Online store', 'Mobile POS'].map(src => {
        const n = Data.orders().filter(o => o.source === src).length;
        const pct = Math.round(n / Data.orders().length * 100);
        return `<div style="padding:8px 16px">
          <div class="spread"><span class="body-m">${src}</span><span class="body-s on-var mono">${n} · ${pct}%</span></div>
          <div style="margin-top:6px">${linear(pct)}</div></div>`;
      }).join('')}
    `)}
    <div class="sp24"></div>`;
  }
});

/* ------------------------------------------------------ STOREFRONT */
MobileRegistry.screen({
  id: 'storefront', title: 'Online store', group: 'More', order: 470, tab: 'more',
  describe: 'The self-service channel, monitored rather than edited. Away mode is here because it is the one switch an operator flips from the road.',
  render: () => `
    ${appbar({ title: 'Online store', nav: 'back', actions: iconAction('eye', 'storefront.preview', { label: 'Preview' }) })}
    ${scroll(`
      <div class="statrow" style="padding-top:8px">
        ${stat('Bookings', Data.orders().filter(o => o.source === 'Online store').length, 'self-service')}
        ${stat('Live products', Data.products().filter(p => p.online).length, `of ${Data.products().length}`)}
        ${stat('Pages', Data.storePages().filter(p => p.status === 'Published').length, 'published')}
      </div>
      <div class="sp16"></div>
      ${switchRow({ label: 'Away mode', support: 'Stop taking new online bookings without unpublishing the store. Existing orders are unaffected.', on: false, act: 'storefront.away' })}
      ${switchRow({ label: 'Block shortage bookings', support: 'Customers only see dates you can actually fulfil', on: true, act: 'storefront.block' })}
      ${sectionHeader('Recent store orders')}
      ${Data.orders().filter(o => o.source === 'Online store').map(o => listItem({
        lines: 3, lead: icon('store', 20, 2), square: true,
        headline: esc(Data.customer(o.customerId).name),
        support: `#${o.number} · ${money(orderTotals(o).total)} · ${fmtRel(o.createdAt)}`,
        trail: badge(Lifecycle.label(o.status), Lifecycle.tone(o.status)),
        act: 'order.open', data: { id: o.id }
      })).join(divider())}
      ${sectionHeader('Pages')}
      ${Data.storePages().map(p => listItem({
        lead: icon('doc', 20, 2), square: true, lines: 2, headline: esc(p.title), support: esc(p.path),
        trail: badge(p.status, p.status === 'Published' ? 'stopped' : 'neutral', false)
      })).join('')}
      <div class="sp24"></div>
    `)}`
});

/* --------------------------------------------------------- SETTINGS */
MobileRegistry.screen({
  id: 'settings', title: 'Settings', group: 'More', order: 480, tab: 'more',
  describe: 'The same eighteen panels the web app registers, rendered as an Android preference list. New panels appear here automatically.',
  render: () => {
    const groups = [];
    Registry.panels().forEach(p => {
      const g = groups.find(x => x.name === p.group);
      if (g) g.items.push(p); else groups.push({ name: p.group, items: [p] });
    });
    const ICONS = { company: 'store', datetime: 'clock', labels: 'tag', locations: 'pin', pricing: 'cash',
      tax: 'chart', coupons: 'tag', payments: 'card', orders: 'orders', fields: 'edit', tags: 'tag',
      emails: 'mail', documents: 'doc', team: 'group', security: 'shield', api: 'key', activity: 'clock', billing: 'card' };
    return `
    ${appbar({ title: 'Settings', nav: 'back', variant: 'large' })}
    ${scroll(`
      ${sectionHeader('Appearance')}
      ${listItem({ lead: icon('palette', 22, 2), square: true, lines: 2, headline: 'Theme',
        support: 'Follow the system, or force light or dark', trail: icon('chevron', 20, 2), act: 'settings.theme' })}
      ${switchRow({ label: 'Dynamic colour', support: 'Use the palette Android extracts from your wallpaper (Material You)', on: false, act: 'settings.dynamic' })}
      ${groups.map(g => `${sectionHeader(g.name)}${g.items.map(p => listItem({
        lead: icon(ICONS[p.id] || 'settings', 22, 2), square: true, lines: 2,
        headline: esc(p.label), support: esc(p.sub || p.title),
        trail: icon('chevron', 20, 2), act: 'settings.panel', data: { id: p.id }
      })).join('')}`).join('')}
      <div class="sp24"></div>
    `)}`;
  }
});

MobileRegistry.screen({
  id: 'settingsPanel', title: 'Settings panel', group: 'More', order: 490, tab: 'more',
  describe: 'A registered panel rendered on mobile. Form panels become preference rows; switch panels become switch rows; table panels become lists.',
  demo: () => ({ id: 'company' }),
  render: ({ params }) => {
    const panel = Registry.panelById(params.id) || Registry.panels()[0];
    let body = '';
    if (panel.kind === 'form') {
      const cfg = Store.config(panel.config) || {};
      body = `<div style="padding:8px 16px">${panel.fields.map(f =>
        textField({ label: f.label, value: String(cfg[f.key] ?? ''), name: f.key, outlined: true, supporting: f.help })).join('')}</div>`;
    } else if (panel.kind === 'switches') {
      body = panel.items().map(it => switchRow({ label: it.label, support: it.help, on: it.on, act: 'settings.toggle', data: { id: it.id } })).join('')
        + (panel.extra || []).map(it => switchRow({ label: it.label, support: it.help, on: it.on })).join('');
    } else if (panel.kind === 'table') {
      body = panel.rows().map(r => listItem({
        lead: icon('chevron', 20, 2), square: true, lines: 2,
        headline: esc(r.name || r.label || r.code || r.id),
        support: esc(r.type || r.address || r.note || r.entity || ''),
        trail: icon('chevron', 20, 2)
      })).join(divider());
    } else {
      body = banner('info', `<b>${esc(panel.title)}</b> is managed on the web dashboard. Mobile shows it read-only so nothing gets misconfigured from a phone.`);
    }
    return `
    ${appbar({ title: esc(panel.label), nav: 'back', subtitle: esc(panel.group) })}
    ${scroll(`${panel.sub ? `<div class="body-m on-var" style="padding:8px 16px 12px;line-height:1.55">${esc(panel.sub)}</div>` : ''}
      ${body}
      ${panel.save ? `<div style="padding:20px 16px">${btn({ label: 'Save changes', kind: 'filled', wide: true, act: 'settings.save' })}</div>` : ''}
      <div class="sp24"></div>`)}`;
  }
});

MobileRegistry.screen({
  id: 'team', title: 'Team', group: 'More', order: 500, tab: 'more',
  describe: 'Members and their 2FA state. Roles decide what each person even sees in this app.',
  render: () => `
    ${appbar({ title: 'Team', nav: 'back', actions: iconAction('add', 'team.invite', { label: 'Invite' }) })}
    ${scroll(`
      ${Data.users().map(u => listItem({
        lines: 3, lead: esc(u.name.split(' ').map(w => w[0]).join('')),
        headline: esc(u.name) + (u.me ? ' <span class="body-s on-var">(you)</span>' : ''),
        support: `${esc(u.email)} · ${esc(u.last)}`,
        trail: badge(u.role, 'neutral', false) + badge(u.twofa ? '2FA on' : '2FA off', u.twofa ? 'stopped' : 'warn', false),
        act: 'team.open', data: { id: u.id }
      })).join(divider())}
      ${Data.users().some(u => !u.twofa) ? banner('warn', `<b>${Data.users().filter(u => !u.twofa).length} member without 2FA.</b> Enforcement will lock them out at next sign-in.`) : ''}
      <div class="sp24"></div>
    `)}`
});

MobileRegistry.screen({
  id: 'profile', title: 'Profile', group: 'More', order: 510, tab: 'more',
  describe: 'The signed-in member: their role, what that role permits, and the session controls.',
  render: () => {
    const me = Data.me();
    const perms = [['Create & edit orders', 1], ['Pick up / return items', 1], ['See prices & totals', 1],
      ['Take payments & refunds', 1], ['Edit products & stock', 1], ['Change settings', 1]];
    return `
    ${appbar({ title: 'Profile', nav: 'back' })}
    ${scroll(`
      <div style="padding:24px 16px;text-align:center">
        <div style="width:88px;height:88px;border-radius:50%;background:var(--md-primary);color:var(--md-on-primary);display:grid;place-items:center;font-size:34px;font-weight:600;margin:0 auto">${esc(me.name.split(' ').map(w => w[0]).join(''))}</div>
        <div class="headline-s" style="margin-top:14px">${esc(me.name)}</div>
        <div class="body-m on-var">${esc(me.email)}</div>
        <div style="margin-top:10px">${badge(me.role, 'info')}</div>
      </div>
      ${sectionHeader('What your role allows')}
      ${perms.map(([label, ok]) => listItem({
        lead: icon(ok ? 'check' : 'close', 20, 2), square: true, lines: 1, headline: esc(label),
        trail: badge(ok ? 'Allowed' : 'No', ok ? 'stopped' : 'neutral', false)
      })).join('')}
      ${sectionHeader('Security')}
      ${listItem({ lead: icon('shield', 22, 2), square: true, lines: 2, headline: 'Two-factor authentication', support: 'Authenticator app · enrolled', trail: badge('On', 'stopped', false) })}
      ${listItem({ lead: icon('key', 22, 2), square: true, lines: 2, headline: 'Change password', support: 'Last changed 4 months ago', trail: icon('chevron', 20, 2) })}
      ${divider(true)}
      ${listItem({ lead: icon('logout', 22, 2), square: true, lines: 1, headline: 'Sign out of this device', act: 'more.signout' })}
      <div class="sp24"></div>
    `)}`;
  }
});

MobileRegistry.screen({
  id: 'sync', title: 'Sync & offline', group: 'More', order: 520, tab: 'more',
  describe: 'Warehouses have bad signal. Pickups and returns queue locally and replay in order; this screen is where you confirm nothing is stuck.',
  render: () => `
    ${appbar({ title: 'Sync & offline', nav: 'back' })}
    ${scroll(`
      <div style="padding:16px">
        <div class="card filled card-pad" style="text-align:center">
          <div style="color:var(--md-primary)">${icon('check', 40, 2)}</div>
          <div class="title-m" style="margin-top:8px">Everything is uploaded</div>
          <div class="body-m on-var" style="margin-top:4px">Last synced 40 seconds ago</div>
        </div>
      </div>
      ${sectionHeader('Queue')}
      ${emptyState('sync', 'Nothing pending', 'Actions taken offline appear here until they reach the server.')}
      ${divider(true)}
      ${switchRow({ label: 'Work offline', support: 'Stop background sync and queue everything until you turn this off', on: false, act: 'sync.offline' })}
      ${switchRow({ label: 'Sync on mobile data', support: 'Off means the app waits for Wi-Fi before uploading photos and signatures', on: true, act: 'sync.data' })}
      ${sectionHeader('Cached for offline use')}
      ${[['Orders', Data.orders().length], ['Products', Data.products().length], ['Customers', Data.customers().length], ['Stock units', Data.stockItems().length]]
        .map(([k, v]) => listItem({ lead: icon('box', 20, 2), square: true, lines: 1, headline: esc(k), trail: `<span class="body-m mono">${v}</span>` })).join('')}
      <div style="padding:16px">${btn({ label: 'Sync now', kind: 'outlined', wide: true, icon: 'sync', act: 'sync.now' })}</div>
      <div class="sp24"></div>
    `)}`
});

MobileRegistry.screen({
  id: 'about', title: 'About', group: 'More', order: 530, tab: 'more',
  describe: 'Version, licences and the legal links Google Play requires to be reachable inside the app.',
  render: () => `
    ${appbar({ title: 'About', nav: 'back' })}
    ${scroll(`
      <div style="padding:32px 16px;text-align:center">
        <div style="width:72px;height:72px;border-radius:20px;background:var(--md-primary);color:var(--md-on-primary);display:grid;place-items:center;font-size:30px;font-weight:700;margin:0 auto">N</div>
        <div class="title-l" style="margin-top:14px">Northlight Rentals</div>
        <div class="body-m on-var">Version 4.12.2 (build 8841)</div>
      </div>
      ${[['Privacy policy', 'shield'], ['Terms of service', 'doc'], ['Open-source licences', 'info'], ['Data safety', 'shield'], ['Contact support', 'mail']]
        .map(([l, ic]) => listItem({ lead: icon(ic, 22, 2), square: true, lines: 1, headline: esc(l), trail: icon('chevron', 20, 2), act: 'about.link' })).join('')}
      ${sectionHeader('Diagnostics')}
      ${[['Data source', Store.adapterName()], ['Screens registered', String(MobileRegistry.count())], ['Android target', 'API 35 (Android 15)'], ['Min SDK', 'API 26 (Android 8.0)']]
        .map(([k, v]) => `<div class="spread" style="padding:10px 16px"><span class="body-m on-var">${esc(k)}</span><span class="body-m mono">${esc(v)}</span></div>`).join('')}
      <div class="sp24"></div>
    `)}`
});

export const MORE_ACTIONS = {
  'more.go': ({ data }) => Nav.push(data.screen),
  'more.signout': () => Nav.dialog({
    title: 'Sign out?', body: 'Anything still queued offline will be lost. Sync first if you are unsure.',
    actions: [{ label: 'Stay', kind: 'text', act: 'nav.dismiss' }, { label: 'Sign out', kind: 'danger', act: 'more.signoutConfirm' }]
  }),
  'more.signoutConfirm': () => { Nav.dismiss(); Nav.goto('signin'); },
  'profile.open': () => Nav.push('profile'),

  'customer.open': ({ data }) => Nav.push('customer', { id: data.id }),
  'customer.new': () => { Nav.dismiss(); Nav.toast('New customer form'); },
  'customer.edit': () => Nav.toast('Editing profiles is a web-dashboard job'),
  'customer.call': ({ data }) => Nav.toast(`Dialling ${Data.customer(data.id).phone}`),
  'customer.email': ({ data }) => Nav.toast(`Composing to ${Data.customer(data.id).email}`),

  'calendar.view': ({ data, state, render }) => { state.calView = data.value; render(); },
  'calendar.pick': ({ data, state, render }) => { state.calDay = data.value; render(); },
  'calendar.today': ({ state, render }) => { state.calDay = new Date().toISOString(); render(); },

  'documents.filter': ({ data, state, render }) => { state.docFilter = data.value; render(); },
  'document.open': ({ data }) => Nav.push('document', { id: data.id }),
  'document.print': () => Nav.toast('Sent to the nearest printer'),
  'document.share': () => Nav.toast('Shared via the Android share sheet'),
  'document.send': ({ data, render }) => {
    const d = Data.document(data.id);
    const o = Data.order(d.orderId);
    d.sentTo = Data.customer(o.customerId).email;
    if (d.status === 'Draft') d.status = 'Sent';
    Store.changed('documents');
    Nav.toast(`${d.number} sent to ${d.sentTo}`); render();
  },
  'document.sign': ({ data, render }) => {
    const d = Data.document(data.id);
    const o = Data.order(d.orderId);
    d.signedBy = Data.customer(o.customerId).contact;
    d.status = 'Signed';
    Store.changed('documents');
    Nav.toast('Signature captured'); render();
  },

  'reports.tab': ({ data, state, render }) => { state.reportTab = data.value; render(); },
  'reports.tick': () => Nav.toast('Picked'),
  'reports.export': () => Nav.toast('Full exports live on the web dashboard'),

  'storefront.preview': () => Nav.toast('Opening northlightrentals.com'),
  'storefront.away': () => Nav.toast('Away mode is off — the store is taking bookings'),
  'storefront.block': () => Nav.toast('Shortage bookings stay blocked'),

  'settings.panel': ({ data }) => Nav.push('settingsPanel', { id: data.id }),
  'settings.save': () => Nav.toast('Saved'),
  'settings.toggle': () => Nav.toast('Setting updated'),
  'settings.theme': () => Nav.sheet({
    title: 'Theme',
    body: `<div style="padding:0 8px">${[['system', 'Follow the system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `
      <button class="li state" data-act="settings.setTheme" data-value="${v}">
        <span class="radio ${(document.documentElement.getAttribute('data-theme') || 'system') === v ? 'on' : ''}"></span>
        <span class="body"><span class="headline">${l}</span></span></button>`).join('')}</div>`
  }),
  'settings.setTheme': ({ data, render }) => {
    if (data.value === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', data.value);
    Nav.dismiss(); render();
  },
  'settings.dynamic': ({ render }) => {
    const on = document.documentElement.getAttribute('data-dynamic') === 'violet';
    if (on) document.documentElement.removeAttribute('data-dynamic');
    else document.documentElement.setAttribute('data-dynamic', 'violet');
    Nav.toast(on ? 'Using the app palette' : 'Using the wallpaper palette (Material You)');
    render();
  },

  'team.invite': () => Nav.toast('Invitations are sent from the web dashboard'),
  'team.open': ({ data }) => Nav.toast(`${Data.users().find(u => u.id === data.id).name} — permissions are web-only`),
  'sync.now': () => Nav.toast('Synced — nothing was pending'),
  'sync.offline': () => Nav.toast('Offline mode toggled'),
  'sync.data': () => Nav.toast('Preference saved'),
  'about.link': () => Nav.toast('Opening in Custom Tabs')
};

export { uid, fmtD, fmtDT, card, chips };
