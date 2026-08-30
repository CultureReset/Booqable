import { Registry } from '../core/registry.js';
import { Data } from '../core/store.js';
import { esc, D, sameDay, startOfDay, addDays } from '../core/util.js';
import { pageHead, chip } from '../core/ui.js';
import { Lifecycle, isLatePickup, isLateReturn } from '../schema/lifecycle.js';
import { availableOnDay, utilisationTone } from '../schema/availability.js';

const VIEWS = [
  { id: 'month', label: 'Orders' },
  { id: 'avail', label: 'Availability' }
];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* Shared with the reports module so both read one implementation. */
export function availabilityGrid({ days = 14, products = null, title = 'Availability · next 14 days' } = {}) {
  const list = [...Array(days)].map((_, i) => addDays(new Date(), i));
  const rows = products || Data.products().filter(p => p.type === 'rental');
  return `
  <div class="row" style="margin-bottom:10px;justify-content:space-between;flex-wrap:wrap">
    <h3 style="font-size:16px">${esc(title)}</h3>
    <div class="legend">
      <span><i style="background:var(--seq-1)"></i>Mostly free</span>
      <span><i style="background:var(--seq-3)"></i>Half booked</span>
      <span><i style="background:var(--seq-5)"></i>Nearly out</span>
      <span><i style="background:var(--crit-bg);outline:1px solid var(--crit)"></i>Shortage</span>
    </div>
  </div>
  <div class="avail"><table>
    <thead><tr><th class="lead">Product</th>
      ${list.map(d => `<th>${d.toLocaleDateString('en-US', { weekday: 'narrow' })}<div class="num" style="font-weight:400">${d.getDate()}</div></th>`).join('')}
    </tr></thead>
    <tbody>${rows.map(p => `<tr>
      <td class="lead"><a href="#/products/${p.id}" data-go="products" data-param="${p.id}" style="font-weight:500">${esc(p.name)}</a>
        <div class="mono dim" style="font-size:11px">${esc(p.sku)} · ${p.stock} owned</div></td>
      ${list.map(d => {
        const a = availableOnDay(p.id, d);
        return `<td><div class="cellv ${utilisationTone(a, p.stock)}" title="${esc(p.name)} · ${d.toDateString()} · ${a} of ${p.stock} free">${a}</div></td>`;
      }).join('')}
    </tr>`).join('')}</tbody>
  </table></div>
  <div class="dim" style="font-size:12px;margin-top:9px">Each cell is the number of units still bookable that day, after reservations, buffer time and maintenance downtime. Red means more is booked than you own.</div>`;
}

Registry.module({
  id: 'calendar', label: 'Calendar', icon: 'calendar', order: 30,

  render({ S, tabState }) {
    const view = tabState('calendar.view', 'month');
    const month = S.scratch.calMonth || (S.scratch.calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    return `
    ${pageHead({
      title: 'Calendar',
      sub: 'Every pickup and return, plus product-level availability across the window',
      actions: `<div class="btn-group">${VIEWS.map(v => `<button class="${view === v.id ? 'on' : ''}" data-tab="calendar.view" data-tab-value="${v.id}">${v.label}</button>`).join('')}</div>
        <button class="btn sm" data-act="calendar.step" data-step="-1">←</button>
        <button class="btn sm" data-act="calendar.step" data-step="0">Today</button>
        <button class="btn sm" data-act="calendar.step" data-step="1">→</button>`
    })}
    ${view === 'avail' ? availabilityGrid() : monthGrid(month)}`;
  },

  actions: {
    'calendar.step': ({ data, S, render }) => {
      const n = +data.step;
      S.scratch.calMonth = n === 0
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        : new Date(S.scratch.calMonth.getFullYear(), S.scratch.calMonth.getMonth() + n, 1);
      render();
    }
  }
});

function monthGrid(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;             // Monday-first
  const gridStart = addDays(first, -offset);
  const cells = [...Array(42)].map((_, i) => addDays(gridStart, i));

  const eventsOn = d => {
    const out = [];
    Data.orders().forEach(o => {
      if (o.status === 'canceled') return;
      if (sameDay(D(o.startsAt), d)) out.push({ o, dir: 'out' });
      if (sameDay(D(o.stopsAt), d)) out.push({ o, dir: 'in' });
    });
    return out.sort((a, b) => D(a.dir === 'out' ? a.o.startsAt : a.o.stopsAt) - D(b.dir === 'out' ? b.o.startsAt : b.o.stopsAt));
  };

  return `
  <div class="row" style="margin-bottom:10px;justify-content:space-between">
    <h3 style="font-size:16px">${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
    <div class="legend">
      ${Object.entries(Lifecycle.states).filter(([id]) => ['reserved', 'started', 'stopped', 'concept'].includes(id))
        .map(([, s]) => `<span><i style="background:var(--st-${s.tone})"></i>${s.label}</span>`).join('')}
      <span><i style="background:var(--crit)"></i>Overdue</span>
    </div>
  </div>
  <div class="cal"><div class="cal-grid">
    ${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}
    ${cells.map(d => {
      const list = eventsOn(d);
      const outside = d.getMonth() !== month.getMonth();
      return `<div class="cal-cell ${outside ? 'out' : ''} ${sameDay(d, new Date()) ? 'today' : ''}">
        <div class="d">${d.getDate()}</div>
        ${list.slice(0, 3).map(e => {
          const late = e.dir === 'out' ? isLatePickup(e.o) : isLateReturn(e.o);
          const tone = late ? 'canceled' : Lifecycle.tone(e.o.status);
          const c = Data.customer(e.o.customerId);
          return `<div class="cal-ev chip ${tone}" data-go="orders" data-param="${e.o.id}" title="#${e.o.number} ${esc(c.name)}">
            <span class="arrow">${e.dir === 'out' ? '↑' : '↓'}</span>#${e.o.number} ${esc(c.name.split(' ')[0])}</div>`;
        }).join('')}
        ${list.length > 3 ? `<div class="cal-more">+${list.length - 3} more</div>` : ''}
      </div>`;
    }).join('')}
  </div></div>`;
}
void chip; void startOfDay;
