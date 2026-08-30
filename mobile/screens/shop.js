/* The other half of the platform: what a renter sees.

   Same Store, same availability engine, same pricing — a different
   audience and a different set of affordances. Shipped as a separate
   Play Store listing in practice; modelled here as its own screen
   group so the flows can be walked end to end. */

import { MobileRegistry, Nav } from '../core/nav.js';
import { Data } from '../../src/core/store.js';
import { esc, addDays, sum, daysBetween } from '../../src/core/util.js';
import { money, money0, fmtD, fmtDY } from '../../src/core/fields.js';
import { Lifecycle } from '../../src/schema/lifecycle.js';
import { chargeUnits } from '../../src/schema/pricing.js';
import { availableQty, availableOnDay } from '../../src/schema/availability.js';
import {
  icon, appbar, iconAction, scroll, listItem, stat, badge, chips, btn, segmented,
  sectionHeader, divider, emptyState, banner, card, searchbar, textField, linear
} from '../core/m3.js';

const CART = { items: [{ id: 'p_1', qty: 1 }, { id: 'p_2', qty: 2 }], start: addDays(new Date(), 5), stop: addDays(new Date(), 8) };
const cartLines = () => CART.items.map(i => ({ p: Data.product(i.id), qty: i.qty }));
const cartDays = () => daysBetween(CART.start, CART.stop);
const cartSub = () => sum(cartLines(), l => l.qty * l.p.price * chargeUnits(l.p, { startsAt: CART.start, stopsAt: CART.stop }));

MobileRegistry.screen({
  id: 'shopHome', title: 'Store — home', group: 'Customer app', order: 600, tab: 'more', standalone: true,
  describe: 'Renter-facing home. Dates come first because in rental nothing can be priced or shown as available until the window is known.',
  render: () => `
    ${appbar({ title: 'Northlight Rentals', nav: 'back',
      actions: iconAction('person', 'shop.account', { label: 'Account' }) + iconAction('box', 'shop.cart', { label: 'Cart', badge: CART.items.length }) })}
    ${scroll(`
      <div style="padding:0 16px 16px">
        <div class="card filled card-pad">
          <div class="label-m on-var">RENTAL PERIOD</div>
          <button class="state" data-act="shop.dates" style="width:100%;text-align:left;margin-top:8px;display:flex;align-items:center;gap:12px">
            ${icon('calendar', 22, 2)}
            <span class="grow"><span class="title-m" style="display:block">${fmtD(CART.start)} → ${fmtD(CART.stop)}</span>
            <span class="body-s on-var">${cartDays()} days · tiered pricing applies</span></span>
            ${icon('chevdown', 20, 2)}
          </button>
        </div>
      </div>
      ${sectionHeader('Browse')}
      <div style="display:flex;gap:10px;overflow-x:auto;padding:0 16px 12px">
        ${Data.collections().filter(c => c.online).map(c => `
          <button class="card outlined state" data-act="shop.collection" data-id="${c.id}" style="flex:none;width:132px;padding:14px;text-align:left">
            <div style="font-size:26px">${esc(Data.products().find(p => p.collection === c.id)?.icon || '📦')}</div>
            <div class="title-s" style="margin-top:8px">${esc(c.name)}</div>
            <div class="body-s on-var">${Data.products().filter(p => p.collection === c.id && p.online).length} items</div>
          </button>`).join('')}
      </div>
      ${sectionHeader('Available for your dates')}
      ${Data.products().filter(p => p.online && ['rental', 'bundle'].includes(p.type)).slice(0, 6).map(p => {
        const a = availableQty(p.id, CART.start.toISOString(), CART.stop.toISOString());
        return listItem({
          lines: 3, lead: p.icon, square: true, headline: esc(p.name),
          support: `${money(p.price)}/day · ${money(p.price * chargeUnits(p, { startsAt: CART.start, stopsAt: CART.stop }))} for ${cartDays()} days`,
          trail: a > 0 ? badge(`${a} available`, 'stopped', false) : badge('Unavailable', 'canceled', false),
          act: 'shop.product', data: { id: p.id }
        });
      }).join(divider())}
      <div class="sp88"></div>
    `)}`
});

MobileRegistry.screen({
  id: 'shopProduct', title: 'Store — product', group: 'Customer app', order: 610, tab: 'more', standalone: true,
  describe: 'Live availability for the chosen window, the real tiered price for that duration, and the deposit stated up front — no surprises at checkout.',
  demo: () => ({ id: 'p_1' }),
  render: ({ params }) => {
    const p = Data.product(params.id) || Data.products()[0];
    const days = cartDays();
    const units = chargeUnits(p, { startsAt: CART.start, stopsAt: CART.stop });
    const a = availableQty(p.id, CART.start.toISOString(), CART.stop.toISOString());
    return `
    ${appbar({ title: '', nav: 'back', actions: iconAction('share', 'shop.share', { label: 'Share' }) + iconAction('star', 'shop.save', { label: 'Save' }) })}
    ${scroll(`
      <div style="height:190px;display:grid;place-items:center;font-size:76px;background:var(--md-container)">${p.icon}</div>
      <div style="padding:16px">
        <div class="headline-s">${esc(p.name)}</div>
        <div class="body-m on-var mono" style="margin-top:4px">${esc(p.sku)}</div>
        <div class="rowc" style="gap:8px;margin-top:12px;flex-wrap:wrap">
          ${a > 0 ? badge(`${a} available ${fmtD(CART.start)}–${fmtD(CART.stop)}`, 'stopped') : badge('Not available for these dates', 'canceled')}
          ${p.deposit ? badge(`${money0(p.deposit)} deposit`, 'neutral', false) : ''}
        </div>
        <div class="sp16"></div>
        <div class="card filled card-pad">
          <div class="spread"><span class="body-m on-var">${money(p.price)} × ${units} (${days} days)</span>
            <span class="headline-s mono">${money(p.price * units)}</span></div>
          <div class="body-s on-var" style="margin-top:6px">Longer hires cost less per day — a week is charged at ×3.5, not ×7.</div>
        </div>
        <div class="sp16"></div>
        <div class="body-m" style="line-height:1.65">${esc(p.desc)}</div>
      </div>
      ${sectionHeader('Next two weeks')}
      <div style="overflow-x:auto;padding:0 16px 8px"><div style="display:flex;gap:4px;min-width:max-content">
        ${[...Array(14)].map((_, i) => {
          const d = addDays(new Date(), i);
          const free = availableOnDay(p.id, d);
          return `<div style="width:32px;text-align:center">
            <div class="body-s on-var" style="font-size:10px">${d.toLocaleDateString('en-US', { weekday: 'narrow' })}</div>
            <div style="height:30px;margin-top:3px;border-radius:8px;display:grid;place-items:center;font-size:11px;font-family:var(--font-mono);
              background:${free > 0 ? 'var(--st-stopped-bg)' : 'var(--md-error-container)'};color:${free > 0 ? 'var(--st-stopped-fg)' : 'var(--md-on-error-container)'}">${free > 0 ? free : '—'}</div>
            <div class="body-s on-var" style="font-size:10px">${d.getDate()}</div></div>`;
        }).join('')}
      </div></div>
      ${p.bundle ? sectionHeader('What is in the kit') + p.bundle.map(bid => {
        const b = Data.product(bid);
        return listItem({ lead: b.icon, square: true, lines: 2, headline: esc(b.name), support: esc(b.sku) });
      }).join('') : ''}
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container);display:flex;gap:10px;align-items:center">
      <div><div class="body-s on-var">Total for ${days} days</div><div class="title-m mono">${money(p.price * units)}</div></div>
      ${btn({ label: 'Add to cart', kind: 'filled', wide: true, act: 'shop.add', data: { id: p.id }, disabled: a <= 0 })}
    </div>`;
  }
});

MobileRegistry.screen({
  id: 'shopCart', title: 'Store — cart', group: 'Customer app', order: 620, tab: 'more', standalone: true,
  describe: 'One rental period governs the whole cart, so the date row sits above the items rather than on each of them.',
  render: () => {
    const lines = cartLines();
    const sub = cartSub();
    const deposit = sum(lines, l => l.p.deposit * l.qty);
    return `
    ${appbar({ title: 'Your cart', nav: 'back' })}
    ${scroll(`
      <div style="padding:0 16px 12px">
        <button class="card filled state" data-act="shop.dates" style="width:100%;padding:14px;text-align:left;display:flex;gap:12px;align-items:center">
          ${icon('calendar', 22, 2)}
          <span class="grow"><span class="title-s" style="display:block">${fmtDY(CART.start)} → ${fmtDY(CART.stop)}</span>
          <span class="body-s on-var">${cartDays()} days</span></span>${icon('edit', 18, 2)}
        </button>
      </div>
      ${lines.map(l => {
        const units = chargeUnits(l.p, { startsAt: CART.start, stopsAt: CART.stop });
        return listItem({
          lines: 3, lead: l.p.icon, square: true, headline: esc(l.p.name),
          support: `${money(l.p.price)} × ${units} × ${l.qty}`,
          trail: `<span class="title-s mono">${money(l.p.price * units * l.qty)}</span><button class="body-s" data-act="shop.remove" data-id="${l.p.id}" style="color:var(--md-error)">Remove</button>`
        });
      }).join(divider()) || emptyState('box', 'Your cart is empty', 'Browse the catalog to add equipment.')}
      ${divider(true)}
      <div style="padding:16px">
        <div class="card outlined card-pad">
          <div class="spread" style="padding:3px 0"><span class="body-m on-var">Subtotal</span><span class="body-m mono">${money(sub)}</span></div>
          <div class="spread" style="padding:3px 0"><span class="body-m on-var">Tax (10.25%)</span><span class="body-m mono">${money(sub * 0.1025)}</span></div>
          <div class="divider full" style="margin:8px 0"></div>
          <div class="spread"><span class="title-m">Total</span><span class="title-m mono">${money(sub * 1.1025)}</span></div>
          ${deposit ? `<div class="spread" style="padding-top:8px"><span class="body-s on-var">Refundable deposit (held, not charged)</span><span class="body-s mono">${money(deposit)}</span></div>` : ''}
        </div>
      </div>
      <div style="padding:0 16px">${banner('info', 'The deposit is a card authorisation, released when everything comes back in good order.')}</div>
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container)">
      ${btn({ label: `Checkout · ${money(sub * 1.1025)}`, kind: 'filled', wide: true, act: 'shop.checkout' })}
    </div>`;
  }
});

MobileRegistry.screen({
  id: 'shopCheckout', title: 'Store — checkout', group: 'Customer app', order: 630, tab: 'more', standalone: true,
  describe: 'Pickup or delivery, contact details, custom checkout fields, then pay now or reserve and pay later — the switch trade accounts need.',
  render: ({ state }) => {
    const mode = state.checkoutMode || 'pickup';
    const pay = state.payMode || 'now';
    return `
    ${appbar({ title: 'Checkout', nav: 'back' })}
    ${scroll(`
      <div style="padding:8px 16px 0">${linear(66)}<div class="body-s on-var" style="margin-top:8px">Step 2 of 3 · details</div></div>
      ${sectionHeader('How will you get it')}
      <div style="padding:0 16px">${segmented([{ id: 'pickup', label: 'Pick up' }, { id: 'delivery', label: 'Delivery' }], mode, 'shop.mode')}</div>
      ${mode === 'pickup' ? Data.locations().filter(l => l.type !== 'Inventory only').map((l, i) => listItem({
        lead: icon('pin', 20, 2), square: true, lines: 2, headline: esc(l.name), support: esc(l.address),
        trail: `<span class="radio ${i === 0 ? 'on' : ''}"></span>`, act: 'shop.location', data: { id: l.id }
      })).join('') : `<div style="padding:8px 16px">
        ${textField({ label: 'Delivery address', value: '', name: 'addr', outlined: true })}
        ${banner('info', 'Delivery inside the metro area adds a $145 setup and strike fee.')}</div>`}
      ${sectionHeader('Your details')}
      <div style="padding:0 16px">
        ${textField({ label: 'Full name', value: 'Jonas Meier', name: 'name', outlined: true })}
        ${textField({ label: 'Email', value: 'jonas.meier@gmail.com', type: 'email', name: 'email', outlined: true })}
        ${textField({ label: 'Phone', value: '+1 206-555-0110', type: 'tel', name: 'phone', outlined: true })}
        ${textField({ label: 'Project or event name', value: '', name: 'project', outlined: true, supporting: 'Custom checkout field' })}
      </div>
      ${sectionHeader('Payment')}
      <div style="padding:0 16px">${segmented([{ id: 'now', label: 'Pay now' }, { id: 'later', label: 'Reserve, pay later' }], pay, 'shop.pay')}</div>
      ${pay === 'now' ? `<div style="padding:8px 16px">
        ${textField({ label: 'Card number', value: '4242 4242 4242 4242', name: 'card', outlined: true })}
        <div class="rowc" style="gap:12px">
          <div class="grow">${textField({ label: 'Expiry', value: '04/29', name: 'exp', outlined: true })}</div>
          <div class="grow">${textField({ label: 'CVC', value: '···', name: 'cvc', outlined: true })}</div>
        </div></div>`
        : `<div style="padding:8px 16px">${banner('info', 'The equipment is reserved now and invoiced after the hire. Available to accounts in good standing.')}</div>`}
      <div style="padding:8px 16px 0" class="body-s on-var" style="line-height:1.6">By booking you accept the rental terms and accept liability for loss or damage.</div>
      <div class="sp88"></div>
    `)}
    <div style="padding:12px 16px 16px;background:var(--md-container)">
      ${btn({ label: pay === 'now' ? `Pay ${money(cartSub() * 1.1025)}` : 'Reserve without paying', kind: 'filled', wide: true, act: 'shop.confirm' })}
    </div>`;
  }
});

MobileRegistry.screen({
  id: 'shopBookings', title: 'Store — my rentals', group: 'Customer app', order: 640, tab: 'more', standalone: true,
  describe: 'The renter\'s own view of the same orders: what they have out, when it is due back, what they owe, and their documents.',
  render: () => {
    const c = Data.customers().find(x => x.id === 'c_2') || Data.customers()[0];
    const mine = Data.orders().filter(o => o.customerId === c.id);
    return `
    ${appbar({ title: 'My rentals', nav: 'back', actions: iconAction('person', 'shop.account', { label: 'Account' }) })}
    ${scroll(`
      ${mine.map(o => {
        const out = ['started', 'mixed'].includes(o.status);
        return `<div style="padding:8px 16px">
          <button class="card outlined state" data-act="shop.booking" data-id="${o.id}" style="width:100%;text-align:left;padding:16px">
            <div class="spread"><span class="body-s on-var mono">#${o.number}</span>
              ${badge(out ? 'With you' : Lifecycle.label(o.status), Lifecycle.tone(o.status))}</div>
            <div class="title-m" style="margin-top:8px">${fmtDY(o.startsAt)} → ${fmtDY(o.stopsAt)}</div>
            <div class="body-m on-var" style="margin-top:4px">${o.lines.length} products · ${sum(o.lines, l => l.qty)} items</div>
            ${out ? `<div style="margin-top:12px">${banner('warn', `Due back ${fmtDY(o.stopsAt)}. Late returns are charged at the daily rate.`)}</div>` : ''}
          </button></div>`;
      }).join('') || emptyState('box', 'No rentals yet', 'Your bookings will show up here.')}
      ${sectionHeader('Documents')}
      ${Data.documents().filter(d => { const o = Data.order(d.orderId); return o && o.customerId === c.id; }).map(d => listItem({
        lead: icon('doc', 20, 2), square: true, lines: 2, headline: esc(d.number),
        support: `${esc(d.type)} · ${fmtDY(d.date)}`, trail: icon('chevron', 18, 2), act: 'document.open', data: { id: d.id }
      })).join('')}
      <div class="sp24"></div>
    `)}`;
  }
});

export const SHOP_ACTIONS = {
  'shop.open': () => Nav.push('shopHome'),
  'shop.dates': () => Nav.sheet({
    title: 'Choose your dates', subtitle: 'Availability and price both depend on the window',
    body: `<div style="padding:0 16px">
      ${textField({ label: 'Pickup', value: fmtDY(CART.start), name: 'start', outlined: true })}
      ${textField({ label: 'Return', value: fmtDY(CART.stop), name: 'stop', outlined: true })}
      <div class="body-s on-var" style="padding:4px">Minimum 1 day · maximum 30 · 4 hours' notice before pickup.</div></div>`,
    actions: [{ label: 'Cancel', kind: 'text', act: 'nav.dismiss' }, { label: 'Apply', kind: 'filled', act: 'shop.applyDates' }]
  }),
  'shop.applyDates': ({ render }) => { Nav.dismiss(); Nav.toast('Availability updated for the new dates'); render(); },
  'shop.collection': ({ data }) => { void data; Nav.toast('Filtered to that collection'); },
  'shop.product': ({ data }) => Nav.push('shopProduct', { id: data.id }),
  'shop.add': ({ data, render }) => {
    const ex = CART.items.find(i => i.id === data.id);
    if (ex) ex.qty++; else CART.items.push({ id: data.id, qty: 1 });
    Nav.toast('Added to your cart', 'View'); render();
  },
  'shop.remove': ({ data, render }) => {
    const i = CART.items.findIndex(x => x.id === data.id);
    if (i > -1) CART.items.splice(i, 1);
    Nav.toast('Removed'); render();
  },
  'shop.cart': () => Nav.push('shopCart'),
  'shop.checkout': () => Nav.push('shopCheckout'),
  'shop.mode': ({ data, state, render }) => { state.checkoutMode = data.value; render(); },
  'shop.pay': ({ data, state, render }) => { state.payMode = data.value; render(); },
  'shop.location': () => Nav.toast('Pickup location set'),
  'shop.confirm': () => { Nav.goto('shopBookings'); Nav.toast('Booked — a confirmation is on its way'); },
  'shop.account': () => Nav.push('shopBookings'),
  'shop.booking': ({ data }) => { void data; Nav.toast('Opening your rental'); },
  'shop.share': () => Nav.toast('Shared'),
  'shop.save': () => Nav.toast('Saved for later')
};

export { card, chips, stat, money0, availableOnDay };
