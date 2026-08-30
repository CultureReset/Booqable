/* Demo account: an AV / event-equipment rental company.

   Pure data, no behaviour. Swap this file (or hand Store a REST adapter)
   and every screen renders someone else's business. */

import { uid, pad, hashCode } from '../core/util.js';

const TODAY = new Date(); TODAY.setHours(9, 0, 0, 0);
const day = n => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; };
const at = (n, h, m = 0) => { const d = day(n); d.setHours(h, m, 0, 0); return d.toISOString(); };

export function buildSeed() {
  const products = [
    { id: 'p_1', sku: 'CAM-A7S3', name: 'Sony FX3 Cinema Camera', type: 'rental', track: 'trackable', icon: '🎥',
      collection: 'col_cam', price: 185, period: 'day', priceType: 'structure', structure: 'ps_std', deposit: 1500,
      stock: 6, buffer: 1, allowShortage: false, shortageLimit: 0, tags: ['fragile', 'insured'], location: 'loc_pdx',
      desc: 'Full-frame cinema camera body, 4K120, with cage and 2× batteries.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_2', sku: 'CAM-LENS24', name: 'Sigma 24–70mm f/2.8 Art', type: 'rental', track: 'trackable', icon: '🔭',
      collection: 'col_cam', price: 55, period: 'day', priceType: 'structure', structure: 'ps_std', deposit: 400,
      stock: 8, buffer: 0, allowShortage: true, shortageLimit: 2, tags: ['fragile'], location: 'loc_pdx',
      desc: 'Fast zoom, E-mount. Ships in padded pouch with both caps.', online: true, taxProfile: 'tp_std',
      variations: [{ name: 'E-mount', stock: 5 }, { name: 'EF-mount', stock: 3 }] },
    { id: 'p_3', sku: 'CAM-GIM2', name: 'DJI RS 4 Pro Gimbal', type: 'rental', track: 'trackable', icon: '🎛️',
      collection: 'col_cam', price: 75, period: 'day', priceType: 'structure', structure: 'ps_std', deposit: 600,
      stock: 3, buffer: 1, allowShortage: false, shortageLimit: 0, tags: ['fragile', 'crew-required'], location: 'loc_pdx',
      desc: '3-axis stabilizer, balanced for FX3 + 24–70.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_4', sku: 'CAM-MON7', name: 'Atomos Ninja 7" Recorder', type: 'rental', track: 'trackable', icon: '📺',
      collection: 'col_cam', price: 45, period: 'day', priceType: 'flat', structure: null, deposit: 300,
      stock: 4, buffer: 0, allowShortage: false, shortageLimit: 0, tags: [], location: 'loc_sea',
      desc: 'HDR field monitor/recorder with 1TB SSD and sun hood.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_5', sku: 'LIT-APS60', name: 'Aputure LS 600d Pro', type: 'rental', track: 'trackable', icon: '💡',
      collection: 'col_lig', price: 120, period: 'day', priceType: 'structure', structure: 'ps_std', deposit: 900,
      stock: 5, buffer: 1, allowShortage: false, shortageLimit: 0, tags: ['heavy', 'crew-required'], location: 'loc_pdx',
      desc: '600W daylight LED with reflector, controller and cable set.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_6', sku: 'LIT-TUBE8', name: 'Astera Titan Tube — 8 pack', type: 'rental', track: 'trackable', icon: '🕯️',
      collection: 'col_lig', price: 210, period: 'day', priceType: 'structure', structure: 'ps_wknd', deposit: 1200,
      stock: 2, buffer: 1, allowShortage: false, shortageLimit: 0, tags: ['insured'], location: 'loc_pdx',
      desc: 'RGB+MINT tubes in charging case with ART7 box.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_7', sku: 'LIT-STND', name: 'C-Stand with Arm', type: 'rental', track: 'bulk', icon: '🦯',
      collection: 'col_grip', price: 12, period: 'day', priceType: 'flat', structure: null, deposit: 0,
      stock: 24, buffer: 0, allowShortage: true, shortageLimit: 6, tags: ['heavy'], location: 'loc_pdx',
      desc: '40" grip head and arm, turtle base.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_8', sku: 'AUD-MIX8', name: 'Zoom F8n Pro Field Mixer', type: 'rental', track: 'trackable', icon: '🎚️',
      collection: 'col_aud', price: 95, period: 'day', priceType: 'structure', structure: 'ps_std', deposit: 700,
      stock: 3, buffer: 0, allowShortage: false, shortageLimit: 0, tags: ['fragile'], location: 'loc_pdx',
      desc: '8-channel recorder with timecode and carry harness.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_9', sku: 'AUD-LAV4', name: 'Sennheiser G4 Lav Kit', type: 'rental', track: 'trackable', icon: '🎤',
      collection: 'col_aud', price: 48, period: 'day', priceType: 'structure', structure: 'ps_std', deposit: 350,
      stock: 6, buffer: 0, allowShortage: true, shortageLimit: 2, tags: [], location: 'loc_pdx',
      desc: 'TX/RX pair, MKE-2 capsule, spare AAs.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_10', sku: 'AUD-BOOM', name: 'Boom Pole + Blimp', type: 'rental', track: 'bulk', icon: '🎙️',
      collection: 'col_aud', price: 30, period: 'day', priceType: 'flat', structure: null, deposit: 0,
      stock: 5, buffer: 0, allowShortage: false, shortageLimit: 0, tags: [], location: 'loc_sea',
      desc: 'Carbon pole with Rycote blimp and windjammer.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_11', sku: 'GRP-DOLLY', name: 'Dana Dolly Kit', type: 'rental', track: 'trackable', icon: '🛞',
      collection: 'col_grip', price: 85, period: 'day', priceType: 'structure', structure: 'ps_std', deposit: 500,
      stock: 2, buffer: 2, allowShortage: false, shortageLimit: 0, tags: ['heavy'], location: 'loc_pdx',
      desc: 'Universal rail kit with 4ft and 6ft speed rail.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_12', sku: 'GRP-SAND', name: 'Sandbag 25lb', type: 'rental', track: 'bulk', icon: '🧱',
      collection: 'col_grip', price: 4, period: 'day', priceType: 'flat', structure: null, deposit: 0,
      stock: 40, buffer: 0, allowShortage: true, shortageLimit: 10, tags: ['heavy'], location: 'loc_pdx',
      desc: 'Saddle-style shot bag.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_13', sku: 'PWR-STN', name: 'EcoFlow Delta Pro Power Station', type: 'rental', track: 'trackable', icon: '🔋',
      collection: 'col_pwr', price: 110, period: 'day', priceType: 'structure', structure: 'ps_std', deposit: 800,
      stock: 2, buffer: 1, allowShortage: false, shortageLimit: 0, tags: ['heavy', 'outdoor-safe'], location: 'loc_pdx',
      desc: '3.6kWh portable power with 120V distro.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_14', sku: 'PWR-STINGER', name: '25ft Stinger', type: 'rental', track: 'bulk', icon: '🔌',
      collection: 'col_pwr', price: 3, period: 'day', priceType: 'flat', structure: null, deposit: 0,
      stock: 60, buffer: 0, allowShortage: true, shortageLimit: 15, tags: [], location: 'loc_pdx',
      desc: '12/3 SJTW extension, black.', online: false, taxProfile: 'tp_std', variations: [] },
    { id: 'p_15', sku: 'SVC-DELIV', name: 'Delivery & Setup (metro)', type: 'service', track: 'bulk', icon: '🚚',
      collection: null, price: 145, period: 'order', priceType: 'fixed', structure: null, deposit: 0,
      stock: 999, buffer: 0, allowShortage: true, shortageLimit: 999, tags: [], location: 'loc_pdx',
      desc: 'Two-person delivery, setup and strike inside the metro area.', online: true, taxProfile: 'tp_svc', variations: [] },
    { id: 'p_16', sku: 'SVC-OP', name: 'Camera Operator (10h day)', type: 'service', track: 'bulk', icon: '👤',
      collection: null, price: 650, period: 'day', priceType: 'fixed', structure: null, deposit: 0,
      stock: 4, buffer: 0, allowShortage: false, shortageLimit: 0, tags: ['crew-required'], location: 'loc_pdx',
      desc: 'Certified operator, 10-hour day, overtime billed hourly.', online: true, taxProfile: 'tp_svc', variations: [] },
    { id: 'p_17', sku: 'SAL-GAFF', name: 'Gaffer Tape 2" (sale)', type: 'sales', track: 'bulk', icon: '📦',
      collection: null, price: 22, period: 'once', priceType: 'fixed', structure: null, deposit: 0,
      stock: 36, buffer: 0, allowShortage: true, shortageLimit: 99, tags: [], location: 'loc_pdx',
      desc: 'Matte black cloth tape, 55yd roll. Sold, not returned.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_18', sku: 'SAL-BATT', name: 'NP-F970 Battery (sale)', type: 'sales', track: 'bulk', icon: '🔋',
      collection: null, price: 64, period: 'once', priceType: 'fixed', structure: null, deposit: 0,
      stock: 20, buffer: 0, allowShortage: true, shortageLimit: 99, tags: [], location: 'loc_pdx',
      desc: 'Replacement L-series battery.', online: true, taxProfile: 'tp_std', variations: [] },
    { id: 'p_19', sku: 'BDL-DOC', name: 'Documentary Kit (bundle)', type: 'bundle', track: 'bulk', icon: '🎬',
      collection: 'col_cam', price: 340, period: 'day', priceType: 'fixed', structure: null, deposit: 2000,
      stock: 3, buffer: 1, allowShortage: false, shortageLimit: 0, tags: ['insured'], location: 'loc_pdx',
      desc: 'FX3 + 24–70 + Zoom F8n + G4 lav + 2× C-stand, priced as one line.',
      bundle: ['p_1', 'p_2', 'p_8', 'p_9', 'p_7'], online: true, taxProfile: 'tp_std', variations: [] }
  ];

  const stockItems = [];
  products.filter(p => p.track === 'trackable').forEach(p => {
    for (let i = 1; i <= p.stock; i++) {
      const broken = i === 2 && p.id === 'p_5';
      stockItems.push({
        id: uid('si'), productId: p.id, identifier: `${p.sku}-${pad(i, 3)}`,
        barcode: 'BQ' + String(Math.abs(hashCode(p.sku + i))).slice(0, 9),
        status: 'in-stock', condition: broken ? 'maintenance' : 'good',
        location: p.location, note: broken ? 'Ballast fan rattle — bench repair' : ''
      });
    }
  });

  const line = (productId, qty, extra = {}) => {
    const p = products.find(x => x.id === productId);
    return { id: uid('ln'), kind: 'product', productId, title: p.name, sku: p.sku, qty,
      priceEach: p.price, taxProfile: p.taxProfile, pickedQty: 0, returnedQty: 0, stockItemIds: [], ...extra };
  };
  const custom = (title, qty, priceEach, note = '') =>
    ({ id: uid('ln'), kind: 'custom', productId: null, title, sku: '—', qty, priceEach,
       taxProfile: 'tp_std', pickedQty: 0, returnedQty: 0, stockItemIds: [], note });

  const orders = [
    { id: 'o_1', number: 1051, status: 'started', customerId: 'c_1', source: 'Back office', locationId: 'loc_pdx',
      startsAt: at(-2, 8), stopsAt: at(0, 17), createdAt: at(-9, 14, 20), deposit: 1500, couponId: null,
      lines: [line('p_1', 2, { pickedQty: 2 }), line('p_2', 2, { pickedQty: 2 }), line('p_5', 3, { pickedQty: 3 }),
              line('p_7', 6, { pickedQty: 6 }), line('p_15', 1, { pickedQty: 1 })],
      fields: { 'Shoot title': 'Harbor — Ep 4', 'On-site contact': 'Renée, 503-555-0188' },
      tags: ['crew-required'], signature: 'Renée Duval', signedAt: at(-2, 7, 52) },

    { id: 'o_2', number: 1052, status: 'started', customerId: 'c_6', source: 'Back office', locationId: 'loc_pdx',
      startsAt: at(-6, 9), stopsAt: at(-1, 12), createdAt: at(-14, 10, 5), deposit: 700, couponId: null,
      lines: [line('p_8', 1, { pickedQty: 1 }), line('p_9', 4, { pickedQty: 4 }), line('p_10', 2, { pickedQty: 2 })],
      fields: { Program: 'Morning Edition remote' }, tags: ['insured'],
      signature: 'Marcus Webb', signedAt: at(-6, 8, 44) },

    { id: 'o_3', number: 1053, status: 'reserved', customerId: 'c_3', source: 'Online store', locationId: 'loc_pdx',
      startsAt: at(0, 7, 30), stopsAt: at(2, 18), createdAt: at(-5, 19, 41), deposit: 1200, couponId: 'cpn_1',
      lines: [line('p_6', 2), line('p_7', 8), line('p_12', 12), line('p_13', 1), line('p_15', 1)],
      fields: { Venue: 'Skamania Lodge, Stevenson WA', 'Guest count': '180' },
      tags: ['outdoor-safe'], signature: null, signedAt: null },

    { id: 'o_4', number: 1054, status: 'reserved', customerId: 'c_4', source: 'Back office', locationId: 'loc_pdx',
      startsAt: at(0, 14), stopsAt: at(1, 11), createdAt: at(-3, 11, 12), deposit: 600, couponId: null,
      lines: [line('p_3', 1), line('p_1', 1), line('p_2', 1), custom('Rush prep fee', 1, 75, 'Same-day turnaround')],
      fields: { 'Shoot title': 'Rowan brand film' }, tags: [], signature: null, signedAt: null },

    { id: 'o_5', number: 1055, status: 'reserved', customerId: 'c_2', source: 'Online store', locationId: 'loc_sea',
      startsAt: at(1, 10), stopsAt: at(4, 10), createdAt: at(-1, 20, 3), deposit: 300, couponId: null,
      lines: [line('p_4', 1), line('p_2', 1), line('p_17', 2)],
      fields: {}, tags: [], signature: null, signedAt: null },

    { id: 'o_6', number: 1056, status: 'concept', customerId: 'c_1', source: 'Back office', locationId: 'loc_pdx',
      startsAt: at(6, 8), stopsAt: at(11, 18), createdAt: at(0, 8, 15), deposit: 2000, couponId: null,
      lines: [line('p_19', 2), line('p_5', 4), line('p_11', 1), line('p_16', 2), line('p_15', 1)],
      fields: { 'Shoot title': 'Harbor — Ep 5 (pending greenlight)' }, tags: [], signature: null, signedAt: null },

    { id: 'o_7', number: 1057, status: 'stopped', customerId: 'c_5', source: 'Mobile POS', locationId: 'loc_pdx',
      startsAt: at(-8, 9), stopsAt: at(-5, 16), createdAt: at(-12, 15, 55), deposit: 400, couponId: 'cpn_2',
      lines: [line('p_2', 1, { pickedQty: 1, returnedQty: 1 }), line('p_7', 2, { pickedQty: 2, returnedQty: 2 }),
              line('p_18', 1, { pickedQty: 1, returnedQty: 1 })],
      fields: {}, tags: [], signature: 'Tomás Herrera', signedAt: at(-8, 9, 6) },

    { id: 'o_8', number: 1058, status: 'archived', customerId: 'c_3', source: 'Back office', locationId: 'loc_pdx',
      startsAt: at(-24, 7), stopsAt: at(-21, 19), createdAt: at(-31, 9, 30), deposit: 0, couponId: null,
      lines: [line('p_6', 1, { pickedQty: 1, returnedQty: 1 }), line('p_12', 20, { pickedQty: 20, returnedQty: 20 }),
              line('p_15', 1, { pickedQty: 1, returnedQty: 1 })],
      fields: { Venue: 'Ecotrust, Portland' }, tags: [], signature: 'Priya Nair', signedAt: at(-24, 7, 10) },

    { id: 'o_9', number: 1049, status: 'canceled', customerId: 'c_2', source: 'Online store', locationId: 'loc_sea',
      startsAt: at(-4, 9), stopsAt: at(-2, 9), createdAt: at(-11, 13, 2), deposit: 0, couponId: null,
      lines: [line('p_4', 1), line('p_10', 1)],
      fields: { 'Cancel reason': 'Shoot postponed — weather' }, tags: [], signature: null, signedAt: null },

    { id: 'o_10', number: 1059, status: 'concept', customerId: 'c_6', source: 'Back office', locationId: 'loc_pdx',
      startsAt: at(3, 9), stopsAt: at(3, 18), createdAt: at(0, 7, 2), deposit: 0, couponId: null,
      lines: [line('p_9', 6), line('p_8', 2), line('p_16', 1)],
      fields: { Program: 'Election night remote' }, tags: ['crew-required'], signature: null, signedAt: null }
  ];

  const pay = (orderId, amount, method, kind, when, status = 'Paid') =>
    ({ id: uid('pay'), orderId, amount, method, kind, when, status });

  const doc = (orderId, type, number, status, date, extra = {}) =>
    ({ id: uid('doc'), orderId, type, number, status, date, signedBy: null, sentTo: null, ...extra });

  const note = (target, targetId, body, by, when) => ({ id: uid('nt'), target, targetId, body, by, when });
  const act = (orderId, what, by, when, hi = false) => ({ id: uid('ac'), orderId, what, by, when, hi });

  return {
    /* ---- config (non-array keys become Store.config) ---- */
    company: {
      name: 'Northlight Rentals', legal: 'Northlight Rentals B.V.', email: 'crew@northlightrentals.com',
      phone: '+1 (503) 555-0142', site: 'northlightrentals.com',
      address: '2140 NW Marshall St', city: 'Portland', zip: '97210', region: 'OR', country: 'United States',
      vat: 'NL8412.55.921.B01', registration: 'CoC 74125588', currency: 'USD', symbol: '$',
      dateFormat: 'MM/DD/YYYY', timeFormat: '12h', timezone: 'America/Los_Angeles',
      weekStart: 'Monday', language: 'English (US)', plan: 'Pro'
    },
    labels: { customer: 'Customer', order: 'Order', product: 'Product', inventory: 'Inventory' },
    orderDefaults: {
      pickupTime: '09:00', returnTime: '17:00', prefix: '', nextNumber: '1060',
      requireSignature: true, warnShortage: true, autoArchive: false
    },
    orderSequence: 1059,

    /* ---- collections ---- */
    locations: [
      { id: 'loc_pdx', name: 'Portland Warehouse', code: 'PDX', type: 'Pickup + inventory', address: '2140 NW Marshall St, Portland OR', main: true },
      { id: 'loc_sea', name: 'Seattle Depot', code: 'SEA', type: 'Pickup + inventory', address: '88 S Dakota St, Seattle WA', main: false },
      { id: 'loc_van', name: 'Mobile Van 01', code: 'VAN', type: 'Inventory only', address: 'Rolling stock', main: false }
    ],
    taxRates: [
      { id: 'tax_none', name: 'No tax', rate: 0, kind: 'Exempt' },
      { id: 'tax_or', name: 'Oregon — 0%', rate: 0, kind: 'Regional' },
      { id: 'tax_wa', name: 'Washington sales — 10.25%', rate: 10.25, kind: 'Regional' },
      { id: 'tax_svc', name: 'Service tax — 6%', rate: 6, kind: 'Compound' }
    ],
    taxProfiles: [
      { id: 'tp_std', name: 'Standard (WA)', rates: ['tax_wa'], default: true },
      { id: 'tp_svc', name: 'Services — 6%', rates: ['tax_svc'], default: false },
      { id: 'tp_exempt', name: 'Tax exempt (non-profit)', rates: ['tax_none'], default: false }
    ],
    collections: [
      { id: 'col_cam', name: 'Cameras', online: true },
      { id: 'col_lig', name: 'Lighting', online: true },
      { id: 'col_aud', name: 'Audio', online: true },
      { id: 'col_grip', name: 'Grip & Support', online: true },
      { id: 'col_pwr', name: 'Power & Cable', online: false }
    ],
    tagList: ['fragile', 'insured', 'heavy', 'crew-required', 'new-2026', 'outdoor-safe'],
    coupons: [
      { id: 'cpn_1', code: 'WEEKEND15', kind: 'Percentage', value: 15, uses: 34, limit: 200, active: true, note: 'Fri–Mon pickups' },
      { id: 'cpn_2', code: 'FILMSCHOOL', kind: 'Percentage', value: 25, uses: 112, limit: 0, active: true, note: 'Verified students' },
      { id: 'cpn_3', code: 'SPRING50', kind: 'Fixed', value: 50, uses: 88, limit: 88, active: false, note: 'Expired 05/2026' }
    ],
    pricingStructures: [
      { id: 'ps_std', name: 'Standard tiered', rows: [{ label: '1 day', mult: 1 }, { label: '2 days', mult: 1.7 }, { label: '3 days', mult: 2.2 }, { label: 'Week (7)', mult: 3.5 }, { label: 'Month (30)', mult: 10 }] },
      { id: 'ps_wknd', name: 'Weekend special', rows: [{ label: '1 day', mult: 1 }, { label: 'Weekend (Fri–Mon)', mult: 1.5 }, { label: 'Week (7)', mult: 3 }, { label: 'Month (30)', mult: 8 }] }
    ],
    users: [
      { id: 'u_1', name: 'Maya Okonkwo', email: 'maya@northlightrentals.com', role: 'Owner', twofa: true, last: '2 minutes ago', me: true },
      { id: 'u_2', name: 'Dev Ramirez', email: 'dev@northlightrentals.com', role: 'Operator', twofa: true, last: 'Today, 07:40' },
      { id: 'u_3', name: 'Sasha Lindqvist', email: 'sasha@northlightrentals.com', role: 'Warehouse', twofa: false, last: 'Yesterday' },
      { id: 'u_4', name: 'Ben Tran', email: 'ben@northlightrentals.com', role: 'Finance', twofa: true, last: '3 days ago' }
    ],
    customers: [
      { id: 'c_1', number: 'CUST-1041', kind: 'Company', name: 'Harbor Films', contact: 'Renée Duval', email: 'renee@harborfilms.co', phone: '+1 503-555-0188',
        address: '411 SE Ash St', city: 'Portland', zip: '97214', country: 'United States', tags: ['insured', 'crew-required'],
        discount: 10, taxProfile: 'tp_exempt', since: '2024-03-11', fields: { 'Insurance expiry': '2027-01-31', 'PO required': 'Yes' } },
      { id: 'c_2', number: 'CUST-1042', kind: 'Individual', name: 'Jonas Meier', contact: 'Jonas Meier', email: 'jonas.meier@gmail.com', phone: '+1 206-555-0110',
        address: '1500 4th Ave', city: 'Seattle', zip: '98101', country: 'United States', tags: [],
        discount: 0, taxProfile: 'tp_std', since: '2025-06-02', fields: { 'ID checked': 'Yes' } },
      { id: 'c_3', number: 'CUST-1043', kind: 'Company', name: 'Cascade Weddings', contact: 'Priya Nair', email: 'events@cascadeweddings.com', phone: '+1 971-555-0164',
        address: '9 Bridgeport Rd', city: 'Tigard', zip: '97223', country: 'United States', tags: ['outdoor-safe'],
        discount: 5, taxProfile: 'tp_std', since: '2023-09-19', fields: { 'Preferred crew': 'Sasha' } },
      { id: 'c_4', number: 'CUST-1044', kind: 'Company', name: 'Rowan & Sky Studio', contact: 'Ada Boateng', email: 'hello@rowanandsky.com', phone: '+1 503-555-0121',
        address: '77 N Killingsworth', city: 'Portland', zip: '97217', country: 'United States', tags: ['insured'],
        discount: 0, taxProfile: 'tp_std', since: '2025-11-04', fields: {} },
      { id: 'c_5', number: 'CUST-1045', kind: 'Individual', name: 'Tomás Herrera', contact: 'Tomás Herrera', email: 't.herrera@outlook.com', phone: '+1 360-555-0177',
        address: '220 W 8th St', city: 'Vancouver', zip: '98660', country: 'United States', tags: [],
        discount: 0, taxProfile: 'tp_std', since: '2026-02-14', fields: {} },
      { id: 'c_6', number: 'CUST-1046', kind: 'Company', name: 'Public Radio KNWL', contact: 'Marcus Webb', email: 'ops@knwl.org', phone: '+1 503-555-0199',
        address: '1200 SW Broadway', city: 'Portland', zip: '97205', country: 'United States', tags: ['insured', 'crew-required'],
        discount: 15, taxProfile: 'tp_exempt', since: '2022-01-08', fields: { 'PO required': 'Yes' } }
    ],
    products,
    stockItems,
    orders,
    payments: [
      pay('o_1', 2100, 'Credit card', 'Down payment', at(-9, 14, 26)),
      pay('o_1', 1500, 'Credit card', 'Security deposit hold', at(-2, 7, 58), 'Authorized'),
      pay('o_2', 1284.5, 'Bank transfer', 'Full payment', at(-13, 9, 12)),
      pay('o_3', 500, 'Credit card', 'Down payment', at(-5, 19, 44)),
      pay('o_7', 318.75, 'Credit card', 'Full payment', at(-12, 15, 58)),
      pay('o_7', 400, 'Credit card', 'Security deposit hold', at(-8, 9, 4), 'Released'),
      pay('o_8', 1109, 'Cash', 'Full payment', at(-21, 19, 20))
    ],
    documents: [
      doc('o_1', 'quote', 'Q-2042', 'Accepted', at(-9, 14, 30), { sentTo: 'renee@harborfilms.co' }),
      doc('o_1', 'contract', 'C-1189', 'Signed', at(-2, 7, 50), { signedBy: 'Renée Duval', sentTo: 'renee@harborfilms.co' }),
      doc('o_1', 'invoice', 'INV-9043', 'Partially paid', at(-9, 14, 32), { sentTo: 'renee@harborfilms.co' }),
      doc('o_1', 'packing', 'PS-771', 'Printed', at(-2, 7, 40)),
      doc('o_2', 'contract', 'C-1190', 'Signed', at(-6, 8, 40), { signedBy: 'Marcus Webb' }),
      doc('o_2', 'invoice', 'INV-9044', 'Paid', at(-13, 9, 10), { sentTo: 'ops@knwl.org' }),
      doc('o_3', 'quote', 'Q-2043', 'Sent', at(-5, 19, 45), { sentTo: 'events@cascadeweddings.com' }),
      doc('o_3', 'invoice', 'INV-9045', 'Overdue', at(-5, 19, 46), { sentTo: 'events@cascadeweddings.com' }),
      doc('o_4', 'quote', 'Q-2044', 'Draft', at(-3, 11, 15)),
      doc('o_5', 'quote', 'Q-2045', 'Sent', at(-1, 20, 5), { sentTo: 'jonas.meier@gmail.com' }),
      doc('o_7', 'invoice', 'INV-9046', 'Paid', at(-12, 16), { sentTo: 't.herrera@outlook.com' }),
      doc('o_7', 'contract', 'C-1191', 'Signed', at(-8, 9, 2), { signedBy: 'Tomás Herrera' }),
      doc('o_8', 'invoice', 'INV-9047', 'Paid', at(-31, 9, 35), { sentTo: 'events@cascadeweddings.com' })
    ],
    notes: [
      note('order', 'o_1', 'Client asked to keep the FX3 cages assembled — do not strip on return.', 'Dev Ramirez', at(-2, 8, 12)),
      note('order', 'o_2', 'LATE: Marcus called, van broke down outside Hood River. Return moved to today 16:00.', 'Maya Okonkwo', at(0, 7, 45)),
      note('order', 'o_3', 'Tubes need full charge cycle the night before — outdoor ceremony runs to 22:00.', 'Sasha Lindqvist', at(-1, 17, 30)),
      note('day', 'dash', 'Sasha out until 11:00 (dentist). Dev covers the morning window.', 'Maya Okonkwo', at(0, 6, 50)),
      note('day', 'dash', 'Van 01 is at the shop — all Seattle pickups happen at the depot counter today.', 'Dev Ramirez', at(0, 7, 10)),
      note('customer', 'c_1', 'Always requires a PO number on the invoice. Finance rejects invoices without it.', 'Ben Tran', at(-40, 10)),
      note('customer', 'c_6', 'Non-profit — tax exempt certificate on file, expires 2027-06-30.', 'Ben Tran', at(-60, 9)),
      note('product', 'p_5', 'Unit -002 has a rattling ballast fan. Flagged for bench repair, do not rent.', 'Sasha Lindqvist', at(-4, 15, 20))
    ],
    activity: [
      act('o_1', 'Order created from the back office', 'Maya Okonkwo', at(-9, 14, 20)),
      act('o_1', 'Quote Q-2042 sent to renee@harborfilms.co', 'Maya Okonkwo', at(-9, 14, 30)),
      act('o_1', 'Down payment of $2,100.00 received (Credit card)', 'System', at(-9, 14, 26)),
      act('o_1', 'Status changed to Reserved', 'Maya Okonkwo', at(-9, 14, 35), true),
      act('o_1', 'Contract C-1189 signed by Renée Duval', 'System', at(-2, 7, 50)),
      act('o_1', '13 items picked up — status changed to Picked up', 'Sasha Lindqvist', at(-2, 8, 3), true),
      act('o_2', 'Order created from the back office', 'Ben Tran', at(-14, 10, 5)),
      act('o_2', 'Status changed to Reserved', 'Ben Tran', at(-14, 10, 9), true),
      act('o_2', '7 items picked up — status changed to Picked up', 'Dev Ramirez', at(-6, 9, 2), true),
      act('o_2', 'Return is overdue by 1 day', 'System', at(0, 8), true),
      act('o_3', 'Order placed through the online store', 'Cascade Weddings', at(-5, 19, 41)),
      act('o_3', 'Coupon WEEKEND15 applied (−15%)', 'System', at(-5, 19, 41)),
      act('o_3', 'Status changed to Reserved', 'System', at(-5, 19, 42), true)
    ],
    downtime: [
      { id: 'dt_1', productId: 'p_5', qty: 1, from: at(-4, 0), to: at(5, 0), reason: 'Bench repair — ballast fan' },
      { id: 'dt_2', productId: 'p_11', qty: 1, from: at(1, 0), to: at(3, 0), reason: 'Rail re-greasing' }
    ],
    customFields: [
      { id: 'cf_1', entity: 'Order', label: 'Shoot title', type: 'Text', required: false, onDocs: true },
      { id: 'cf_2', entity: 'Order', label: 'On-site contact', type: 'Text', required: false, onDocs: true },
      { id: 'cf_3', entity: 'Order', label: 'Venue', type: 'Text', required: false, onDocs: true },
      { id: 'cf_4', entity: 'Customer', label: 'Insurance expiry', type: 'Date', required: false, onDocs: false },
      { id: 'cf_5', entity: 'Customer', label: 'PO required', type: 'Yes / No', required: false, onDocs: true },
      { id: 'cf_6', entity: 'Product', label: 'Serial prefix', type: 'Text', required: false, onDocs: false }
    ],
    emailTemplates: [
      { id: 'et_1', name: 'Order confirmation', type: 'Automatic', trigger: 'Order reserved', subject: 'Your {{order.number}} is confirmed', on: true },
      { id: 'et_2', name: 'Payment receipt', type: 'Automatic', trigger: 'Payment received', subject: 'Receipt for {{order.number}}', on: true },
      { id: 'et_3', name: 'Pickup reminder', type: 'Automatic', trigger: '1 day before pickup', subject: 'Pickup tomorrow at {{order.starts_at}}', on: true },
      { id: 'et_4', name: 'Return reminder', type: 'Automatic', trigger: 'Morning of return', subject: '{{order.number}} is due back today', on: true },
      { id: 'et_5', name: 'Overdue notice', type: 'Automatic', trigger: '1 day after return', subject: 'Overdue: {{order.number}}', on: false },
      { id: 'et_6', name: 'Quote follow-up', type: 'Manual', trigger: 'Sent by hand', subject: 'Still thinking it over?', on: true },
      { id: 'et_7', name: 'Damage report', type: 'Manual', trigger: 'Sent by hand', subject: 'Damage found on {{order.number}}', on: true }
    ],
    providers: [
      { id: 'pp_stripe', name: 'Stripe', on: true, methods: 'Cards, Apple Pay, Google Pay, Tap to Pay', note: 'Deposits held as pre-authorisations for up to 7 days' },
      { id: 'pp_manual', name: 'Manual / offline', on: true, methods: 'Cash, bank transfer, check', note: 'Registered by hand on the order' },
      { id: 'pp_paypal', name: 'PayPal', on: false, methods: 'PayPal balance, cards', note: 'Not connected' }
    ],
    apiKeys: [
      { id: 'ak_1', name: 'Warehouse scanner app', prefix: 'bq_live_7f2a…', created: at(-120, 10), lastUsed: '12 minutes ago', scopes: 'orders:read, products:read' },
      { id: 'ak_2', name: 'Website (headless)', prefix: 'bq_live_c91d…', created: at(-300, 10), lastUsed: 'Today, 08:14', scopes: 'orders:write, availability:read' }
    ],
    apps: [
      { id: 'ap_1', name: 'Zapier', cat: 'Automation', on: true, desc: 'Fire workflows on new orders, payments and returns.' },
      { id: 'ap_2', name: 'QuickBooks', cat: 'Accounting', on: true, desc: 'Push invoices and payments to your ledger nightly.' },
      { id: 'ap_3', name: 'Google Analytics 4', cat: 'Analytics', on: true, desc: 'Track store sessions and checkout funnels.' },
      { id: 'ap_4', name: 'Mailchimp', cat: 'Marketing', on: false, desc: 'Sync customers into audiences.' },
      { id: 'ap_5', name: 'Xero', cat: 'Accounting', on: false, desc: 'Alternative ledger sync.' },
      { id: 'ap_6', name: 'Slack', cat: 'Notifications', on: true, desc: 'Post new bookings and overdue returns to a channel.' }
    ],
    storePages: [
      { id: 'sp_1', title: 'Home', path: '/', status: 'Published', updated: at(-12, 10) },
      { id: 'sp_2', title: 'Rental catalog', path: '/rent', status: 'Published', updated: at(-12, 10) },
      { id: 'sp_3', title: 'How it works', path: '/how-it-works', status: 'Published', updated: at(-30, 10) },
      { id: 'sp_4', title: 'Delivery areas', path: '/delivery', status: 'Draft', updated: at(-2, 16) },
      { id: 'sp_5', title: 'Contact', path: '/contact', status: 'Published', updated: at(-30, 10) }
    ]
  };
}
