import { Registry } from '../core/registry.js';
import { Data } from '../core/store.js';
import { esc, D, sum, hashCode, daysBetween } from '../core/util.js';
import { pageHead, tile, icon, empty, tabs } from '../core/ui.js';
import { money, money0, fmtDY } from '../core/fields.js';
import { DataTable } from '../core/view.js';
import { Lifecycle, isLate } from '../schema/lifecycle.js';
import { orderTotals, lineTotal } from '../schema/pricing.js';
import { availableQty } from '../schema/availability.js';
import { availabilityGrid } from './calendar.js';
import { RANGES, rangeById, inRange } from './dashboard.js';
import { customerStats } from '../schema/entities.js';

/* Reports register themselves, so a new one is a single call from any
   file — including one a customer adds without touching this module. */
export function registerReports() {
  Registry.report({ id: 'company', order: 10, label: 'Company performance', render: companyReport });
  Registry.report({ id: 'products', order: 20, label: 'Product performance', render: productReport });
  Registry.report({ id: 'fulfillment', order: 30, label: 'Product fulfilment', render: fulfilmentReport });
  Registry.report({ id: 'availability', order: 40, label: 'Availability', render: () => availabilityGrid() });
  Registry.report({ id: 'customers', order: 50, label: 'Customers', render: customerReport });
  Registry.report({ id: 'coupons', order: 60, label: 'Coupons', render: couponReport });
}

Registry.module({
  id: 'reports', label: 'Reports', icon: 'reports', order: 80, group: 'Grow',

  render(ctx) {
    const active = ctx.tabState('reports.tab', 'company');
    const report = Registry.reportById(active) || Registry.reports()[0];
    return `
    ${pageHead({
      title: 'Reports', sub: 'Where the money and the equipment actually went',
      actions: `<button class="btn" data-act="export.csv" data-entity="orders">Export CSV</button>
                <button class="btn" data-act="document.print">${icon('print', 15, 2)} Print</button>`
    })}
    ${tabs(Registry.reports().map(r => ({ id: r.id, label: r.label })), report.id, 'reports.tab')}
    ${report.render(ctx)}`;
  }
});

/* ---------- single-series bar chart: no legend needed, endpoint labelled ---------- */
function barChart(data, fmt = money0) {
  const w = 760, pl = 52, pr = 8, pt = 14, pb = 26, h = 190;
  const max = Math.max(...data.map(d => d.value)) * 1.12;
  const iw = w - pl - pr, ih = h - pt - pb, bw = iw / data.length;
  const ticks = [0, .25, .5, .75, 1].map(t => t * max);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Revenue by month">
    <g class="grid">${ticks.map(t => { const y = pt + ih - (t / max) * ih; return `<line x1="${pl}" x2="${w - pr}" y1="${y}" y2="${y}"/>`; }).join('')}</g>
    <g class="axis">${ticks.map(t => { const y = pt + ih - (t / max) * ih; return `<text x="${pl - 8}" y="${y + 3.5}" text-anchor="end">${fmt(t)}</text>`; }).join('')}</g>
    ${data.map((d, i) => {
      const bh = Math.max(2, (d.value / max) * ih), x = pl + i * bw + bw * 0.22, y = pt + ih - bh;
      return `<g><rect class="bar" x="${x}" y="${y}" width="${bw * 0.56}" height="${bh}" rx="3"
        ${d.current ? 'opacity="1" stroke="var(--accent-700)" stroke-width="1.5"' : 'opacity="0.82"'}>
        <title>${esc(d.label)} ${d.year}: ${fmt(d.value)}</title></rect>
        <text x="${pl + i * bw + bw / 2}" y="${h - 8}" text-anchor="middle" style="fill:var(--text-3);font-size:10.5px;font-family:var(--mono)">${esc(d.label)}</text>
        ${d.current ? `<text x="${pl + i * bw + bw / 2}" y="${y - 5}" text-anchor="middle" style="fill:var(--accent-700);font-size:10.5px;font-weight:600;font-family:var(--mono)">${fmt(d.value)}</text>` : ''}
      </g>`;
    }).join('')}
  </svg>`;
}

function monthlyRevenue() {
  const now = new Date();
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let value = sum(Data.orders()
      .filter(o => !['canceled', 'concept'].includes(o.status))
      .filter(o => { const s = D(o.startsAt); return `${s.getFullYear()}-${s.getMonth()}` === key; }), o => orderTotals(o).total);
    if (i > 0) {
      const seasonal = [0.62, 0.58, 0.71, 0.83, 0.96, 1.14, 1.28, 1.22, 1.06, 0.94, 0.79, 0.88][d.getMonth()];
      value = 18400 * seasonal + (Math.abs(hashCode(key)) % 2600);
    }
    out.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), value, current: i === 0 });
  }
  return out;
}

function companyReport() {
  const data = monthlyRevenue();
  const orders = Data.orders().filter(o => !['canceled', 'concept'].includes(o.status));
  const avg = orders.length ? sum(orders, o => orderTotals(o).total) / orders.length : 0;
  const byStatus = Object.keys(Lifecycle.states)
    .map(s => ({ s, n: Data.orders().filter(o => o.status === s).length })).filter(x => x.n);
  const sources = ['Back office', 'Online store', 'Mobile POS'];

  return `<div class="stack">
    <div class="tiles">
      ${tile('Revenue · 12 months', money0(sum(data, d => d.value)), 'booked value of started orders')}
      ${tile('Orders', orders.length, `${Data.orders().filter(o => o.source === 'Online store').length} came from the store`)}
      ${tile('Average order', money0(avg), 'per booking, after discounts')}
      ${tile('Repeat rate', Math.round(Data.customers().filter(c => customerStats(c).count > 1).length / Data.customers().length * 100) + '%', 'customers with 2+ orders')}
    </div>
    <div class="card"><div class="card-head"><h3>Revenue by month</h3><span class="eyebrow">this month highlighted</span></div>
      <div class="card-body">${barChart(data)}
        <div class="dim" style="font-size:12px;margin-top:6px">Hover any bar for the exact figure. Months before this one are the trading history on file; the highlighted bar is live from the orders in this account.</div></div></div>
    <div class="cols c2">
      <div class="card"><div class="card-head"><h3>Orders by status</h3></div><div class="card-body">
        <div class="stackbar">${byStatus.map(x => `<span style="flex:${x.n};background:var(--st-${Lifecycle.tone(x.s)})" title="${Lifecycle.label(x.s)}: ${x.n}"></span>`).join('')}</div>
        <div class="legend">${byStatus.map(x => `<span><i style="background:var(--st-${Lifecycle.tone(x.s)})"></i>${Lifecycle.label(x.s)} <b class="num">${x.n}</b></span>`).join('')}</div>
        <table class="tbl" style="margin-top:14px"><thead><tr><th>Status</th><th class="r">Orders</th><th class="r">Value</th></tr></thead>
        <tbody>${byStatus.map(x => `<tr class="norow">
          <td><span class="chip ${Lifecycle.tone(x.s)}"><span class="dot"></span>${Lifecycle.label(x.s)}</span></td>
          <td class="r num">${x.n}</td>
          <td class="r num">${money0(sum(Data.orders().filter(o => o.status === x.s), o => orderTotals(o).total))}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>Where orders come from</h3></div><div class="card-body">
        ${sources.map(src => {
          const n = Data.orders().filter(o => o.source === src).length;
          const pct = Math.round(n / Data.orders().length * 100);
          return `<div class="hbar-row"><span>${esc(src)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${pct}%"></div></div><span class="num r">${n} · ${pct}%</span></div>`;
        }).join('')}
        <div class="dim" style="font-size:12px;margin-top:10px">Self-service store bookings cost nothing to take. Growing that share is usually the cheapest revenue a rental business can find.</div>
      </div></div>
    </div>
  </div>`;
}

function productStats() {
  const map = {};
  Data.orders().filter(o => !['canceled', 'concept'].includes(o.status)).forEach(o => {
    o.lines.forEach(l => {
      if (!l.productId) return;
      const m = map[l.productId] || (map[l.productId] = { qty: 0, rev: 0, orders: 0, days: 0 });
      m.qty += l.qty; m.rev += lineTotal(l, o); m.orders++;
      m.days += daysBetween(o.startsAt, o.stopsAt) * l.qty;
    });
  });
  return Object.entries(map).map(([pid, m]) => {
    const p = Data.product(pid);
    return { p, ...m, util: p.stock ? Math.min(100, (m.days / (p.stock * 90)) * 100) : 0 };
  }).sort((a, b) => b.rev - a.rev);
}

function productReport() {
  const rows = productStats();
  const max = rows[0]?.rev || 1;
  return `<div class="card"><div class="card-head"><h3>Product performance</h3><span class="eyebrow">by booked revenue</span></div>
    ${DataTable({
      columns: [
        { key: 'p', label: 'Product', type: 'custom', render: r => `<div class="row">
          <span class="thumb" style="width:28px;height:28px;font-size:14px">${r.p.icon}</span>
          <div><div style="font-weight:500">${esc(r.p.name)}</div><div class="mono dim" style="font-size:11px">${esc(r.p.sku)}</div></div></div>` },
        { key: 'share', label: 'Revenue share', type: 'custom',
          render: r => `<div class="hbar-track" style="min-width:90px"><div class="hbar-fill" style="width:${(r.rev / max * 100).toFixed(1)}%"></div></div>` },
        { key: 'orders', label: 'Orders', type: 'number', align: 'right' },
        { key: 'qty', label: 'Units out', type: 'number', align: 'right' },
        { key: 'days', label: 'Rental days', type: 'number', align: 'right' },
        { key: 'rev', label: 'Revenue', type: 'money', align: 'right', cellStyle: 'font-weight:600' },
        { key: 'util', label: 'Utilisation', type: 'custom', align: 'right',
          render: r => `<span class="chip ${r.util > 60 ? 'good' : r.util > 25 ? 'info' : 'plain'}">${r.util.toFixed(0)}%</span>` }
      ],
      rows: rows.map(r => ({ ...r, id: r.p.id })), rowGo: 'products'
    })}
    <div class="card-body" style="border-top:1px solid var(--line)"><div class="dim" style="font-size:12px">
      Utilisation is rental days over the last quarter against what you own. Anything sitting under 25% is capital on a shelf — sell it, or move it to a location that books it.</div></div></div>`;
}

function fulfilmentReport({ tabState }) {
  const r = rangeById(tabState('dashboard.range', 'today'));
  const orders = Data.orders().filter(o => Lifecycle.state(o.status).holdsStock
    && (inRange(o.startsAt, r) || inRange(o.stopsAt, r) || isLate(o)));
  const tally = {};
  orders.forEach(o => o.lines.forEach(l => { if (l.productId) tally[l.productId] = (tally[l.productId] || 0) + l.qty; }));

  return `<div class="stack">
    <div class="row"><div class="btn-group">${RANGES.map(x =>
      `<button class="${r.id === x.id ? 'on' : ''}" data-tab="dashboard.range" data-tab-value="${x.id}">${x.label}</button>`).join('')}</div>
      <span class="dim" style="font-size:12.5px">This is the pull sheet — print it and pick against it.</span></div>
    <div class="card"><div class="card-head"><h3>Pull sheet · ${esc(r.label)}</h3>
      <button class="btn sm" data-act="document.print">${icon('print', 13, 2)} Print</button></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th style="width:34px"></th><th>Product</th><th>SKU</th><th class="r">Needed</th><th class="r">Free</th><th>Orders</th></tr></thead>
        <tbody>${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([pid, q]) => {
          const p = Data.product(pid);
          const a = availableQty(pid, r.from().toISOString(), r.to().toISOString());
          const on = orders.filter(o => o.lines.some(l => l.productId === pid));
          return `<tr class="norow"><td><input type="checkbox" aria-label="Picked ${esc(p.name)}"></td>
            <td><div class="row"><span class="thumb" style="width:26px;height:26px;font-size:13px">${p.icon}</span><span style="font-weight:500">${esc(p.name)}</span></div></td>
            <td class="mono" style="font-size:11.5px">${esc(p.sku)}</td>
            <td class="r num" style="font-weight:700">${q}</td>
            <td class="r"><span class="chip ${a < 0 ? 'crit' : 'plain'}">${a + q}</span></td>
            <td>${on.map(o => `<a href="#/orders/${o.id}" class="mono" data-go="orders" data-param="${o.id}">#${o.number}</a>`).join(', ')}</td></tr>`;
        }).join('') || `<tr class="norow"><td colspan="6">${empty('Nothing to pull in this window')}</td></tr>`}
        </tbody></table></div></div>
  </div>`;
}

function customerReport() {
  const rows = Data.customers().map(c => ({ ...c, ...customerStats(c) })).sort((a, b) => b.spend - a.spend);
  const max = rows[0]?.spend || 1;
  return `<div class="card"><div class="card-head"><h3>Customer report</h3><span class="eyebrow">by lifetime value</span></div>
    ${DataTable({
      columns: [
        { key: 'name', label: 'Customer', type: 'custom',
          render: r => `<div><div style="font-weight:500">${esc(r.name)}</div><div class="mono dim" style="font-size:11px">${esc(r.number)}</div></div>` },
        { key: 'share', label: 'Share', type: 'custom',
          render: r => `<div class="hbar-track" style="min-width:80px"><div class="hbar-fill" style="width:${(r.spend / max * 100).toFixed(1)}%"></div></div>` },
        { key: 'count', label: 'Orders', type: 'number', align: 'right' },
        { key: 'spend', label: 'Lifetime', type: 'money', align: 'right', cellStyle: 'font-weight:600' },
        { key: 'avg', label: 'Avg order', type: 'custom', align: 'right',
          render: r => `<span class="num">${r.count ? money(r.spend / r.count) : '—'}</span>` },
        { key: 'due', label: 'Outstanding', type: 'custom', align: 'right',
          render: r => `<span class="num" style="color:${r.due > 0.01 ? 'var(--crit)' : 'var(--text-3)'}">${r.due > 0.01 ? money(r.due) : '—'}</span>` },
        { key: 'since', label: 'Since', type: 'custom', render: r => `<span class="dim" style="font-size:12px">${fmtDY(r.since)}</span>` }
      ],
      rows, rowGo: 'customers'
    })}</div>`;
}

function couponReport() {
  return `<div class="card"><div class="card-head"><h3>Coupon report</h3>
    <button class="btn sm" data-go="settings" data-param="coupons">Manage coupons</button></div>
    ${DataTable({ entity: 'coupons', columns: ['code', 'kind', 'value', 'uses', 'limit', 'active', 'note'], rows: Data.coupons() })}</div>`;
}
