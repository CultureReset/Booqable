/* Scan tab and Catalog tab. */

import { MobileRegistry, Nav } from '../core/nav.js';
import { Data, Store } from '../../src/core/store.js';
import { esc, addDays, sum } from '../../src/core/util.js';
import { money, money0, fmtDY } from '../../src/core/fields.js';
import { Lifecycle } from '../../src/schema/lifecycle.js';
import { lineTotal } from '../../src/schema/pricing.js';
import { availableOnDay, availableQty, utilisationTone } from '../../src/schema/availability.js';
import {
  icon, appbar, iconAction, scroll, listItem, stat, badge, chips, btn, segmented,
  sectionHeader, divider, emptyState, banner, card, searchbar, switchRow, textField
} from '../core/m3.js';

/* ------------------------------------------------------------ SCAN */
MobileRegistry.screen({
  id: 'scan', title: 'Scanner', group: 'Scan', order: 300, tab: 'scan',
  describe: 'Camera viewfinder with a reticle, torch and manual entry. It keeps the bottom navigation — a tab destination that hides it traps the user, so only the flow-scoped scanner goes full screen.',
  render: ({ params = {} }) => `
    <div style="flex:1;min-height:0;background:#0A0D0F;display:flex;flex-direction:column">
      <div class="appbar" style="background:transparent;color:#fff">
        <button class="iconbtn state" data-nav="back" style="color:#fff">${icon('close')}</button>
        <div class="title" style="color:#fff">${params.mode === 'fulfil' ? 'Scan items out' : 'Scan'}</div>
        <button class="iconbtn state" data-act="scan.torch" style="color:#fff">${icon('flash')}</button>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:20px">
        <div style="position:relative;width:250px;height:180px">
          <div style="position:absolute;inset:0;border-radius:16px;background:rgba(255,255,255,.04)"></div>
          ${[[0, 0, '0 0 0 3px'], [1, 0, ''], [0, 1, ''], [1, 1, '']].map((_, i) => {
            const t = i < 2 ? 'top:-2px' : 'bottom:-2px';
            const l = i % 2 === 0 ? 'left:-2px' : 'right:-2px';
            const b = i < 2
              ? (i % 2 === 0 ? 'border-top:4px solid #6FD8EB;border-left:4px solid #6FD8EB;border-radius:16px 0 0 0'
                             : 'border-top:4px solid #6FD8EB;border-right:4px solid #6FD8EB;border-radius:0 16px 0 0')
              : (i % 2 === 0 ? 'border-bottom:4px solid #6FD8EB;border-left:4px solid #6FD8EB;border-radius:0 0 0 16px'
                             : 'border-bottom:4px solid #6FD8EB;border-right:4px solid #6FD8EB;border-radius:0 0 16px 0');
            return `<span style="position:absolute;${t};${l};width:34px;height:34px;${b}"></span>`;
          }).join('')}
          <span style="position:absolute;left:10px;right:10px;height:2px;background:#6FD8EB;box-shadow:0 0 14px #6FD8EB;animation:scanline 1.8s ease-in-out infinite"></span>
        </div>
        <div style="color:#E6EDF2;text-align:center;max-width:260px" class="body-m" data-scan-hint>
          ${params.mode === 'fulfil'
            ? 'Scan each case as it leaves. Ticked lines update on the pickup screen behind this one.'
            : 'Point at a barcode or QR code on a case, a customer card, or a printed order sheet.'}
        </div>
      </div>
      <div style="padding:0 20px 26px" class="gap">
        <div class="rowc" style="gap:8px;justify-content:center;flex-wrap:wrap">
          ${Data.stockItems().slice(0, 2).map(si =>
            `<button class="btn tonal state" data-act="scan.hit" data-stock="${si.id}">${esc(si.identifier)}</button>`).join('')}
        </div>
        ${btn({ label: 'Enter code by hand', kind: 'outlined', wide: true, icon: 'keyboard', act: 'scan.manual' })}
      </div>
    </div>
    <style>@keyframes scanline{0%{top:8px}50%{top:168px}100%{top:8px}}</style>`
});

MobileRegistry.screen({
  id: 'scanResult', title: 'Scan result', group: 'Scan', order: 310, tab: 'scan',
  describe: 'What the code resolved to, and every next step available from it — so a scan is never a dead end.',
  demo: () => ({ stock: null }),
  render: ({ params }) => {
    const si = params.stock ? Data.stockItems().find(s => s.id === params.stock) : Data.stockItems()[0];
    const p = Data.product(si.productId);
    const onOrder = Data.orders().find(o => Lifecycle.state(o.status).holdsStock && o.lines.some(l => l.productId === p.id));
    return `
    ${appbar({ title: 'Scanned', nav: 'back' })}
    ${scroll(`
      <div style="padding:0 16px">
        <div class="card filled card-pad">
          <div class="rowc" style="gap:14px">
            <span style="width:52px;height:52px;border-radius:var(--sh-md);background:var(--md-container-lowest);display:grid;place-items:center;font-size:26px">${p.icon}</span>
            <div class="grow"><div class="title-m">${esc(p.name)}</div>
              <div class="body-s on-var mono" style="margin-top:2px">${esc(si.identifier)} · ${esc(si.barcode)}</div></div>
          </div>
          <div class="sp16"></div>
          <div class="rowc" style="gap:8px;flex-wrap:wrap">
            ${badge(si.condition === 'maintenance' ? 'On the bench' : 'In stock', si.condition === 'maintenance' ? 'warn' : 'stopped')}
            ${badge(esc(Data.location(si.location).name), 'neutral', false)}
          </div>
        </div>
      </div>
      ${onOrder ? `${sectionHeader('On an open order')}
        ${listItem({
          lines: 3, lead: `<span class="label-m mono">#${onOrder.number}</span>`, square: true,
          headline: esc(Data.customer(onOrder.customerId).name),
          support: `${fmtDY(onOrder.startsAt)} → ${fmtDY(onOrder.stopsAt)}`,
          trail: badge(Lifecycle.label(onOrder.status), Lifecycle.tone(onOrder.status)),
          act: 'order.open', data: { id: onOrder.id }
        })}` : banner('info', 'This unit is not on any open order right now.')}
      ${sectionHeader('Actions')}
      ${listItem({ lead: icon('catalog', 22, 2), square: true, headline: 'Open the product', lines: 1, trail: icon('chevron', 20, 2), act: 'product.open', data: { id: p.id } })}
      ${listItem({ lead: icon('warn', 22, 2), square: true, headline: si.condition === 'maintenance' ? 'Return to service' : 'Send to the bench', lines: 1, act: 'stock.toggle', data: { id: si.id } })}
      ${listItem({ lead: icon('add', 22, 2), square: true, headline: 'Add to an order', lines: 1, act: 'scan.addTo' })}
      <div class="sp24"></div>
    `)}`;
  }
});

/* --------------------------------------------------------- CATALOG */
const CAT_FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'rental', label: 'Rentals', match: p => p.type === 'rental' },
  { id: 'free', label: 'Free today', match: p => p.type !== 'service' && availableOnDay(p.id, new Date()) > 0 },
  { id: 'out', label: 'Fully booked', match: p => p.type !== 'service' && availableOnDay(p.id, new Date()) <= 0 },
  { id: 'service', label: 'Services', match: p => p.type === 'service' },
  { id: 'sales', label: 'Sales items', match: p => p.type === 'sales' },
  { id: 'bundle', label: 'Bundles', match: p => p.type === 'bundle' }
];

MobileRegistry.screen({
  id: 'catalog', title: 'Catalog', group: 'Catalog', order: 320, tab: 'catalog',
  describe: 'Inventory as staff need it on the floor: what is free right now, filterable, with a grid view for visual recognition of cases.',
  render: ({ state }) => {
    const active = state.catFilter || 'all';
    const view = state.catView || 'list';
    const f = CAT_FILTERS.find(x => x.id === active) || CAT_FILTERS[0];
    const rows = Data.products().filter(f.match);
    return `
    ${appbar({
      title: 'Catalog', nav: 'none',
      actions: iconAction(view === 'list' ? 'catalog' : 'orders', 'catalog.view', { label: 'Toggle view' })
        + iconAction('search', 'search.open', { label: 'Search' })
    })}
    ${searchbar('Name, SKU or barcode')}
    ${chips(CAT_FILTERS.map(x => ({ id: x.id, label: x.label })), active, 'catalog.filter')}
    ${scroll(view === 'grid' ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 16px">
        ${rows.map(p => {
          const a = availableOnDay(p.id, new Date());
          return `<button class="card outlined state" data-act="product.open" data-id="${p.id}" style="text-align:left;padding:0">
            <div style="height:84px;display:grid;place-items:center;font-size:34px;background:var(--md-container)">${p.icon}</div>
            <div style="padding:10px 12px">
              <div class="title-s trunc">${esc(p.name)}</div>
              <div class="body-s on-var mono">${esc(p.sku)}</div>
              <div class="spread" style="margin-top:8px">
                <span class="body-s mono">${money(p.price)}</span>
                ${p.type === 'rental' ? badge(`${a}`, a <= 0 ? 'canceled' : a <= 2 ? 'started' : 'stopped', false) : badge(p.type, 'neutral', false)}
              </div>
            </div></button>`;
        }).join('')}
      </div><div class="sp88"></div>
    ` : `
      ${rows.map(p => {
        const a = availableOnDay(p.id, new Date());
        return listItem({
          lines: 3, lead: p.icon, square: true, headline: esc(p.name),
          support: `${esc(p.sku)} · ${money(p.price)}/${esc(p.period)} · ${esc(p.track)}`,
          trail: p.type === 'rental' || p.type === 'bundle'
            ? badge(`${a} free`, a <= 0 ? 'canceled' : a <= p.stock * 0.25 ? 'started' : 'stopped', false) + `<span class="body-s">of ${p.stock}</span>`
            : badge(p.type, 'neutral', false),
          act: 'product.open', data: { id: p.id }
        });
      }).join(divider()) || emptyState('catalog', 'Nothing matches', 'Try another filter.')}
      <div class="sp88"></div>
    `)}`;
  }
});

MobileRegistry.screen({
  id: 'product', title: 'Product', group: 'Catalog', order: 330, tab: 'catalog',
  describe: 'A 21-day availability strip is the headline, because the only question asked at the counter is "can I promise this".',
  demo: () => ({ id: 'p_5' }),
  render: ({ params, state }) => {
    const p = Data.product(params.id) || Data.products()[0];
    const tab = state.productTab || 'overview';
    const items = Data.stockItems().filter(si => si.productId === p.id);
    const free = availableOnDay(p.id, new Date());
    const days = [...Array(21)].map((_, i) => addDays(new Date(), i - 2));
    const bookings = Data.orders().filter(o => Lifecycle.state(o.status).holdsStock && o.lines.some(l => l.productId === p.id));
    const revenue = sum(Data.orders().filter(o => !['canceled', 'concept'].includes(o.status)),
      o => sum(o.lines.filter(l => l.productId === p.id), l => lineTotal(l, o)));

    return `
    ${appbar({ title: esc(p.name), nav: 'back', subtitle: esc(p.sku),
      actions: iconAction('print', 'product.labels', { label: 'Print labels' }) + iconAction('more', 'product.menu', { label: 'More' }) })}
    ${scroll(`
      <div style="height:132px;display:grid;place-items:center;font-size:60px;background:var(--md-container)">${p.icon}</div>
      <div style="padding:16px">
        <div class="rowc" style="gap:8px;flex-wrap:wrap">
          ${badge(p.type, 'neutral', false)}${badge(p.track, 'neutral', false)}
          ${p.allowShortage ? badge(`shortage ≤ ${p.shortageLimit}`, 'warn', false) : ''}
          ${p.buffer ? badge(`${p.buffer}d buffer`, 'neutral', false) : ''}
          ${p.online ? badge('On the store', 'stopped', false) : badge('Hidden online', 'neutral', false)}
        </div>
        <div class="sp16"></div>
        <div class="rowc" style="gap:8px">
          ${stat('Free today', p.type === 'service' ? 'n/a' : free, `of ${p.stock} owned`, free <= 0 ? 'alert' : '')}
          ${stat('Rate', money0(p.price), `per ${p.period}`)}
          ${stat('Booked', money0(revenue), 'lifetime')}
        </div>
      </div>
      ${chips([{ id: 'overview', label: 'Overview' }, { id: 'units', label: `Units (${items.length})` }, { id: 'orders', label: `On orders (${bookings.length})` }], tab, 'product.tab', { id: p.id })}
      ${tab === 'overview' ? `
        ${sectionHeader('Next three weeks')}
        <div style="overflow-x:auto;padding:0 16px 4px"><div style="display:flex;gap:4px;min-width:max-content">
          ${days.map(d => {
            const a = availableOnDay(p.id, d);
            const tone = utilisationTone(a, p.stock);
            return `<div style="width:34px;text-align:center">
              <div class="body-s on-var">${d.toLocaleDateString('en-US', { weekday: 'narrow' })}</div>
              <div style="height:34px;margin-top:3px;border-radius:var(--sh-sm);display:grid;place-items:center;font-family:var(--font-mono);font-size:12px;
                background:${tone === 'short' ? 'var(--md-error-container)' : tone === 's0' ? 'var(--md-container-high)' : `color-mix(in srgb, var(--md-primary) ${{ s1: 18, s2: 36, s3: 55, s4: 75, s5: 92 }[tone] || 10}%, var(--md-container-high))`};
                color:${tone === 'short' ? 'var(--md-on-error-container)' : ['s4', 's5'].includes(tone) ? 'var(--md-on-primary)' : 'var(--md-on-surface)'}">${a}</div>
              <div class="body-s on-var" style="font-size:10px;margin-top:2px">${d.getDate()}</div>
            </div>`;
          }).join('')}
        </div></div>
        <div class="body-s on-var" style="padding:10px 16px 0;line-height:1.5">Units still bookable each day, after reservations, buffer time and anything on the bench.</div>
        ${sectionHeader('Description')}
        <div class="body-m" style="padding:0 16px 16px;line-height:1.6">${esc(p.desc)}</div>
        ${p.bundle ? sectionHeader('Bundle contents') + p.bundle.map(bid => {
          const b = Data.product(bid);
          return listItem({ lead: b.icon, square: true, lines: 2, headline: esc(b.name), support: esc(b.sku), trail: '<span class="body-s">1 unit</span>' });
        }).join('') : ''}
        ${sectionHeader('Pricing')}
        ${listItem({ lead: icon('cash', 20, 2), square: true, lines: 2, headline: `${money(p.price)} per ${p.period}`, support: `${p.priceType} pricing${p.deposit ? ` · ${money(p.deposit)} deposit` : ''}` })}
      ` : tab === 'units' ? `
        ${items.length ? items.map(si => {
          const on = Data.orders().find(o => o.lines.some(l => l.stockItemIds.includes(si.id)));
          return listItem({
            lines: 2, lead: icon('box', 20, 2), square: true,
            headline: `<span class="mono">${esc(si.identifier)}</span>`,
            support: `${esc(si.barcode)}${si.note ? ` · ${esc(si.note)}` : ''}`,
            trail: si.condition === 'maintenance' ? badge('Bench', 'warn')
              : on ? badge(`#${on.number}`, 'started') : badge('In stock', 'stopped'),
            act: 'stock.open', data: { id: si.id }
          });
        }).join(divider()) : emptyState('box', 'Bulk tracked', 'This product counts quantity rather than individual units.')}
        <div style="padding:16px">${btn({ label: 'Add a unit', kind: 'outlined', wide: true, icon: 'add', act: 'stock.add', data: { id: p.id } })}</div>
      ` : `
        ${bookings.length ? bookings.map(o => listItem({
          lines: 3, lead: `<span class="label-m mono">#${o.number}</span>`, square: true,
          headline: esc(Data.customer(o.customerId).name),
          support: `${fmtDY(o.startsAt)} → ${fmtDY(o.stopsAt)} · ${sum(o.lines.filter(l => l.productId === p.id), l => l.qty)} units`,
          trail: badge(Lifecycle.label(o.status), Lifecycle.tone(o.status)),
          act: 'order.open', data: { id: o.id }
        })).join(divider()) : emptyState('orders', 'Not on any open order', 'Every unit is on the shelf.')}
      `}
      <div class="sp88"></div>
    `)}`;
  }
});

MobileRegistry.screen({
  id: 'stock', title: 'Stock unit', group: 'Catalog', order: 340, tab: 'catalog',
  describe: 'One physical unit: its barcode label, condition and history. Where a damaged item gets taken out of availability.',
  demo: () => ({ id: null }),
  render: ({ params }) => {
    const si = params.id ? Data.stockItems().find(s => s.id === params.id) : Data.stockItems()[0];
    const p = Data.product(si.productId);
    return `
    ${appbar({ title: si.identifier, nav: 'back', subtitle: esc(p.name) })}
    ${scroll(`
      <div style="padding:16px">
        <div class="card outlined card-pad" style="text-align:center">
          <div style="display:flex;gap:2px;align-items:flex-end;height:56px;justify-content:center">
            ${[...Array(34)].map((_, i) => `<i style="display:block;width:${(i * 7 % 3) + 1}px;height:${i % 4 === 0 ? 56 : 44}px;background:var(--md-on-surface);opacity:${i % 2 ? .25 : 1}"></i>`).join('')}
          </div>
          <div class="mono body-m" style="margin-top:10px">${esc(si.barcode)}</div>
          <div class="body-s on-var">${esc(si.identifier)}</div>
        </div>
      </div>
      ${sectionHeader('Status')}
      ${listItem({ lead: icon('info', 20, 2), square: true, lines: 2, headline: 'Condition',
        support: si.note || 'No issues recorded', trail: badge(si.condition === 'maintenance' ? 'On the bench' : 'Good', si.condition === 'maintenance' ? 'warn' : 'stopped') })}
      ${listItem({ lead: icon('pin', 20, 2), square: true, lines: 2, headline: 'Location', support: esc(Data.location(si.location).address), trail: badge(Data.location(si.location).code, 'neutral', false) })}
      ${divider(true)}
      ${switchRow({ label: 'Available to rent', support: 'Turning this off removes the unit from every availability check', on: si.condition !== 'maintenance', act: 'stock.toggle', data: { id: si.id } })}
      ${sectionHeader('Actions')}
      ${listItem({ lead: icon('print', 20, 2), square: true, lines: 1, headline: 'Print a replacement label', act: 'product.labels' })}
      ${listItem({ lead: icon('swap', 20, 2), square: true, lines: 1, headline: 'Move to another location', act: 'stock.move' })}
      <div class="sp24"></div>
    `)}`;
  }
});

export const CATALOG_ACTIONS = {
  'scan.open': () => Nav.push('scan'),
  'scan.torch': () => Nav.toast('Torch on'),
  'scan.manual': () => Nav.sheet({
    title: 'Enter a code',
    body: `<div style="padding:0 16px">${textField({ label: 'Barcode or order number', value: '', name: 'code', outlined: true })}</div>`,
    actions: [{ label: 'Cancel', kind: 'text', act: 'nav.dismiss' }, { label: 'Look up', kind: 'filled', act: 'scan.lookup' }]
  }),
  'scan.lookup': () => { Nav.dismiss(); Nav.push('scanResult', { stock: Data.stockItems()[0].id }); },
  'scan.hit': ({ data }) => Nav.push('scanResult', { stock: data.stock }),
  'scan.addTo': () => Nav.toast('Choose an order to add this unit to'),
  'catalog.filter': ({ data, state, render }) => { state.catFilter = data.value; render(); },
  'catalog.view': ({ state, render }) => { state.catView = state.catView === 'grid' ? 'list' : 'grid'; render(); },
  'product.open': ({ data, state, render }) => { state.productTab = 'overview'; Nav.push('product', { id: data.id }); void render; },
  'product.tab': ({ data, state, render }) => { state.productTab = data.value; render(); },
  'product.labels': () => { Nav.dismiss(); Nav.toast('Sent to the label printer'); },
  'product.menu': ({ data }) => Nav.menu({
    items: [
      { label: 'Schedule downtime', icon: 'clock', act: 'product.downtime', data },
      { label: 'Print all labels', icon: 'print', act: 'product.labels', data },
      { label: 'Edit on the web', icon: 'share', act: 'product.web', data }
    ]
  }),
  'product.downtime': () => { Nav.dismiss(); Nav.toast('Downtime scheduling lives on the web dashboard'); },
  'product.web': () => { Nav.dismiss(); Nav.toast('Opening northlightrentals.com in the browser'); },
  'stock.open': ({ data }) => Nav.push('stock', { id: data.id }),
  'stock.toggle': ({ data, render }) => {
    const si = Data.stockItems().find(s => s.id === data.id);
    si.condition = si.condition === 'maintenance' ? 'good' : 'maintenance';
    if (si.condition === 'good') si.note = '';
    Store.changed('stockItems');
    Nav.toast(si.condition === 'maintenance' ? 'Taken out of availability' : 'Back in service');
    render();
  },
  'stock.add': () => Nav.toast('Adding units is a web-dashboard job'),
  'stock.move': () => Nav.toast('Choose the destination location'),
  'catalog.availability': () => Nav.toast('Opening the availability matrix')
};

export { availableQty, card, money0 };
