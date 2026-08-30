import { Registry } from '../core/registry.js';
import { Data } from '../core/store.js';
import { esc } from '../core/util.js';
import { pageHead, card, chip, icon, tabs } from '../core/ui.js';
import { money, fmtRel } from '../core/fields.js';
import { DataTable } from '../core/view.js';

/* Storefront sections are declared, so reordering or adding one is a
   data edit. Each returns markup for the panel body. */
const SECTIONS = [
  { id: 'pages', order: 10, label: 'Pages', render: pages },
  { id: 'theme', order: 20, label: 'Theme & design', render: theme },
  { id: 'booking', order: 30, label: 'Booking rules', render: booking },
  { id: 'checkout', order: 40, label: 'Checkout', render: checkout },
  { id: 'domain', order: 50, label: 'Domain & SEO', render: domain }
];

Registry.module({
  id: 'store', label: 'Online store', icon: 'store', order: 70, group: 'Grow',

  render({ tabState }) {
    const active = tabState('store.section', 'pages');
    const section = SECTIONS.find(s => s.id === active) || SECTIONS[0];
    return `
    ${pageHead({
      title: 'Online store',
      sub: 'The self-service side — where customers find, price and book equipment on their own',
      actions: '<button class="btn" data-act="store.preview">Preview store</button><button class="btn primary" data-act="store.publish">Publish changes</button>'
    })}
    ${tabs(SECTIONS.map(s => ({ id: s.id, label: s.label })), section.id, 'store.section')}
    ${section.render()}`;
  },

  actions: {
    'store.preview': ({ toast }) => toast('Opening the storefront in a new tab'),
    'store.publish': ({ toast }) => toast('Storefront published')
  }
});

function pages() {
  return `<div class="card">
    <div class="card-head"><h3>Pages</h3><button class="btn sm">${icon('plus', 13, 2.4)} New page</button></div>
    ${DataTable({
      columns: [
        { key: 'title', label: 'Title', type: 'text', cellStyle: 'font-weight:500' },
        { key: 'path', label: 'Path', type: 'mono' },
        { key: 'status', label: 'Status', type: 'chip', tone: v => v === 'Published' ? 'good' : 'plain', chipLabel: v => v },
        { key: 'updated', label: 'Last updated', type: 'custom', render: p => `<span class="dim" style="font-size:12px">${fmtRel(p.updated)}</span>` },
        { key: 'act', label: '', align: 'right', type: 'custom', render: () => '<button class="btn sm">Edit</button>' }
      ], rows: Data.storePages() })}
    <div class="card-body" style="border-top:1px solid var(--line)">
      <div class="eyebrow" style="margin-bottom:8px">Collections shown in the catalog</div>
      <div class="wrap">${Data.collections().map(c => chip(`${c.name} · ${Data.products().filter(p => p.collection === c.id).length}`, c.online ? 'good' : 'plain', false)).join('')}</div>
    </div></div>`;
}

function theme() {
  return `<div class="cols c2">
    ${card({ title: 'Theme', body: `
      <div class="grid2">
        <div class="field"><label>Active theme</label><select><option>Studio (default)</option><option>Warehouse</option><option>Minimal</option></select></div>
        <div class="field"><label>Accent colour</label><input type="color" value="#0B7285"></div>
        <div class="field"><label>Heading font</label><select><option>Archivo</option><option>Inter</option><option>Source Serif</option></select></div>
        <div class="field"><label>Corner radius</label><select><option>Soft (8px)</option><option>Square</option><option>Pill</option></select></div>
      </div>
      <div class="eyebrow" style="margin:16px 0 8px">Sections on the home page</div>
      ${['Hero with search', 'Featured collections', 'How it works', 'Availability checker', 'Testimonials', 'Footer']
        .map(s => `<div class="checkline on"><input type="checkbox" checked><div class="grow">${s}</div><span class="dim">drag to reorder</span></div>`).join('')}` })}
    ${card({ title: 'Storefront preview', body: `
      <div class="doc-preview" style="padding:0;overflow:hidden">
        <div style="background:var(--accent);color:var(--on-accent);padding:22px 18px">
          <div style="font-family:var(--display);font-size:19px;font-weight:600">${esc(Data.company().name)}</div>
          <div style="opacity:.9;font-size:12.5px;margin-top:3px">Camera, lighting and audio rental in Portland &amp; Seattle</div>
          <div style="background:var(--surface);border-radius:8px;padding:8px 11px;margin-top:12px;color:var(--text-3);font-size:12px">Pick your dates to see what's free →</div>
        </div>
        <div style="padding:14px">
          <div class="eyebrow" style="margin-bottom:8px">Featured</div>
          <div class="pgrid" style="grid-template-columns:repeat(2,1fr);gap:9px">
            ${Data.products().filter(p => p.online).slice(0, 4).map(p => `<div class="pcard" style="box-shadow:none">
              <div class="img" style="height:62px;font-size:23px">${p.icon}</div>
              <div class="b" style="padding:7px 9px"><div class="nm trunc" style="font-size:11.5px">${esc(p.name)}</div>
                <div class="num dim" style="font-size:11px">${money(p.price)}/day</div></div></div>`).join('')}
          </div>
        </div>
      </div>` })}
  </div>`;
}

function booking() {
  const d = Data.orderDefaults();
  return card({ body: `
    <div class="grid2">
      <div class="field"><label>Minimum rental duration</label><input value="1 day"></div>
      <div class="field"><label>Maximum rental duration</label><input value="30 days"></div>
      <div class="field"><label>Lead time before pickup</label><input value="4 hours"></div>
      <div class="field"><label>Default pickup time</label><input type="time" value="${esc(d.pickupTime)}"></div>
      <div class="field"><label>Default return time</label><input type="time" value="${esc(d.returnTime)}"></div>
      <div class="field"><label>Bookable window ahead</label><input value="180 days"></div>
    </div>
    <div class="eyebrow" style="margin:18px 0 8px">Operating hours</div>
    ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => `
      <div class="checkline ${i < 6 ? 'on' : ''}"><input type="checkbox" ${i < 6 ? 'checked' : ''}>
        <div class="grow" style="font-weight:500">${day}</div>
        <span class="mono dim" style="font-size:12px">${i < 5 ? '08:00 – 18:00' : i === 5 ? '10:00 – 16:00' : 'Closed'}</span></div>`).join('')}
    <div class="switch-row" style="margin-top:14px"><button class="switch"></button>
      <div><div class="t">Away mode</div><div class="d">Stop taking new online bookings without unpublishing the store. Existing orders are unaffected.</div></div></div>
    <div class="switch-row"><button class="switch on"></button>
      <div><div class="t">Block bookings that would cause a shortage</div><div class="d">Customers only see dates you can actually fulfil.</div></div></div>` });
}

function checkout() {
  return card({ body: `
    ${[['Require an account', true, 'Customers log in to see their order history and documents.'],
       ['Pay now', true, 'Card is charged at checkout through Stripe.'],
       ['Pay later option', true, 'Reserve without paying — you invoice afterwards. Useful for trade accounts.'],
       ['Collect a security deposit', true, 'Held as a pre-authorisation for up to 7 days, released on return.'],
       ['Offer delivery at checkout', false, 'Adds the delivery service line and asks for an address.']]
      .map(([label, on, help]) => `<div class="switch-row"><button class="switch ${on ? 'on' : ''}"></button>
        <div><div class="t">${label}</div><div class="d">${help}</div></div></div>`).join('')}
    <div class="eyebrow" style="margin:18px 0 8px">Custom checkout fields</div>
    ${['Project or event name', 'Insurance certificate number', 'Delivery instructions']
      .map(f => `<div class="checkline"><input type="checkbox" checked><div class="grow">${f}</div><span class="dim">optional</span></div>`).join('')}
    <div class="eyebrow" style="margin:18px 0 8px">Cross-sell at checkout</div>
    <div class="wrap">${Data.products().filter(p => ['sales', 'service'].includes(p.type))
      .map(p => `<span class="chip plain">${p.icon} ${esc(p.name)}</span>`).join('')}</div>` });
}

function domain() {
  const co = Data.company();
  return card({ body: `
    <div class="grid2">
      <div class="field"><label>Custom domain</label><input value="${esc(co.site)}"><span class="hint">DNS verified · SSL active</span></div>
      <div class="field"><label>Booqable subdomain</label><input value="northlight.booqable.shop" readonly></div>
      <div class="field"><label>Store title</label><input value="${esc(co.name)} — Camera &amp; lighting rental"></div>
      <div class="field"><label>Meta description</label><input value="Rent cinema cameras, lighting and audio in Portland and Seattle. Same-day pickup, delivery available."></div>
    </div>
    <div class="switch-row" style="margin-top:14px"><button class="switch on"></button>
      <div><div class="t">XML sitemap</div><div class="d">Published at /sitemap.xml and pinged on every change.</div></div></div>
    <div class="switch-row"><button class="switch"></button>
      <div><div class="t">Password-protect the store</div><div class="d">Useful while you are still setting up.</div></div></div>
    <div class="eyebrow" style="margin:18px 0 8px">URL redirects</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>From</th><th>To</th><th>Type</th></tr></thead><tbody>
      <tr class="norow"><td class="mono">/gear</td><td class="mono">/rent</td><td>301</td></tr>
      <tr class="norow"><td class="mono">/cameras</td><td class="mono">/rent?collection=cameras</td><td>301</td></tr>
    </tbody></table></div>` });
}
