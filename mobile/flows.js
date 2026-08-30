/* End-to-end journeys.

   Each step is a real screen rendered with real data — the same render
   functions the device runs — so a flow can never drift from the app. */

import { MobileRegistry, Nav } from './core/nav.js';
import { esc } from '../src/core/util.js';
import { Data } from '../src/core/store.js';

const reserved = () => Data.orders().find(o => o.status === 'reserved') || Data.orders()[0];
const out = () => Data.orders().find(o => ['started', 'mixed'].includes(o.status)) || Data.orders()[0];

export const FLOWS = [
  {
    id: 'firstrun', title: 'First run', goal: 'A new team member gets from install to a working counter.',
    steps: [
      { screen: 'splash', cap: 'Cold start', tap: 'The SplashScreen API holds the branded frame while the app warms.' },
      { screen: 'signin', cap: 'Sign in', tap: 'Work email and password, or SSO for accounts that enforce it.' },
      { screen: 'twofa', cap: 'Two-factor', tap: 'Six digits from the authenticator. Not skippable when the account requires it.' },
      { screen: 'workspace', cap: 'Pick a counter', tap: 'The home location filters every list that follows.' },
      { screen: 'permissions', cap: 'Explain, then ask', tap: 'Rationale before the system prompt — camera for scanning, notifications for overdue returns.' },
      { screen: 'today', cap: 'Landed', tap: 'Straight into the day, no empty dashboard.' }
    ]
  },
  {
    id: 'pickup', title: 'Morning pickup', goal: 'A customer arrives to collect a reserved order.',
    steps: [
      { screen: 'today', cap: 'See who is coming', tap: 'Pickups panel, sorted by time, with anything past due flagged red.' },
      { screen: 'order', params: () => ({ id: reserved().id }), cap: 'Open the order', tap: 'Status, money owed and shortages all above the fold.' },
      { screen: 'pickup', params: () => ({ id: reserved().id }), cap: 'Tick or scan each line', state: { }, tap: 'Trackable products name the exact unit. Scanning is the fast path; the checklist is the fallback.' },
      { screen: 'scan', params: () => ({ mode: 'fulfil' }), cap: 'Scan the cases', tap: 'Decoding is on-device. Each hit ticks the line behind this screen.' },
      { screen: 'signature', params: () => ({ id: reserved().id }), cap: 'Customer signs', tap: 'On-glass signature, stamped onto the contract.' },
      { screen: 'order', params: () => ({ id: reserved().id }), cap: 'Now Picked up', tap: 'Stock is out. The web dashboard, calendar and reports all move with it.' }
    ]
  },
  {
    id: 'return', title: 'Overdue return', goal: 'Equipment comes back late and something is damaged.',
    steps: [
      { screen: 'today', cap: 'The alert', tap: 'Overdue returns get a red banner, not a buried counter.' },
      { screen: 'orders', state: { orderFilter: 'late' }, cap: 'Filter to overdue', tap: 'One chip. The list is already sorted by how late.' },
      { screen: 'order', params: () => ({ id: out().id }), cap: 'Check what is out', tap: 'Fulfilment counts show how many of the items are still with the customer.' },
      { screen: 'return', params: () => ({ id: out().id }), cap: 'Check it back in', tap: 'Tick what came back, note the condition, withhold from the deposit if needed.' },
      { screen: 'order', params: () => ({ id: out().id }), cap: 'Deposit settled', tap: 'Withheld amount is captured; the remainder is released automatically.' }
    ]
  },
  {
    id: 'walkin', title: 'Walk-in booking', goal: 'Someone walks in with no reservation and wants gear today.',
    steps: [
      { screen: 'orders', cap: 'Start from Orders', tap: 'The FAB is the only create affordance — one per screen, bottom right.' },
      { screen: 'orderNew', state: { newCustomer: 'c_2' }, cap: 'Customer and dates', tap: 'Concept holds nothing; Reserve takes stock off the shelf immediately.' },
      { screen: 'itemPicker', params: () => ({ id: reserved().id }), cap: 'Add gear', tap: 'Availability is computed for the exact window, so an unbookable item is visible before it is added.' },
      { screen: 'order', params: () => ({ id: reserved().id }), cap: 'Priced automatically', tap: 'Tiered pricing, the customer discount and tax all apply without a decision.' },
      { screen: 'catalog', cap: 'Check what else is free', tap: 'Same availability engine, browsable while the customer is standing there.' }
    ]
  },
  {
    id: 'scan', title: 'Scan to answer', goal: 'A case is on the bench and nobody knows whose it is.',
    steps: [
      { screen: 'scan', cap: 'Point at the label', tap: 'Torch, manual entry, and a reticle sized for a case label at arm\'s length.' },
      { screen: 'scanResult', cap: 'What it is', tap: 'Unit, condition, location, and the open order it belongs to — never a dead end.' },
      { screen: 'stock', cap: 'Take it out of service', tap: 'One switch removes the unit from every availability check, everywhere.' },
      { screen: 'product', params: () => ({ id: 'p_5' }), cap: 'See the impact', tap: 'The 21-day strip drops by one immediately.' }
    ]
  },
  {
    id: 'renter', title: 'Renter self-service', goal: 'A customer books without anyone at the shop touching it.',
    steps: [
      { screen: 'shopHome', cap: 'Dates first', tap: 'Nothing in rental can be priced or shown as available until the window is known.' },
      { screen: 'shopProduct', params: () => ({ id: 'p_1' }), cap: 'Real availability', tap: 'Live per-day counts and the true tiered price for that duration.' },
      { screen: 'shopCart', cap: 'One period, many items', tap: 'The date row sits above the items because it governs all of them.' },
      { screen: 'shopCheckout', cap: 'Pickup or delivery', tap: 'Pay now, or reserve and be invoiced — the switch trade accounts need.' },
      { screen: 'shopBookings', cap: 'Their own view', tap: 'Same orders, renter framing: what is out, when it is due, what they owe.' },
      { screen: 'today', cap: 'It lands on the counter', tap: 'The booking appears in the operator app with source "Online store".' }
    ]
  }
];

export function renderFlows({ screenBody, deviceChrome }) {
  const mini = (id, params, state) => {
    const def = MobileRegistry.get(id);
    if (!def) return '';
    return `<div class="mini m3">${deviceChrome(
      screenBody(def, params ?? (def.demo ? def.demo() : {}), Object.assign({}, state)),
      { standalone: def.standalone, tab: def.tab })}</div>`;
  };
  return `
    <div class="pcard" style="margin-bottom:20px">
      <h3>${FLOWS.length} journeys, start to finish</h3>
      <div class="lede">Every frame is the live screen with live data, not a mockup. Click a step to open it on the device.</div>
    </div>
    <div class="flowgrid">
      ${FLOWS.map(f => `
        <div>
          <div class="flowhead"><h2>${esc(f.title)}</h2><span class="goal">${esc(f.goal)}</span></div>
          <div class="steps">
            ${f.steps.map((s, i) => `
              <div class="step">
                <div class="stepframe" data-goto="${esc(s.screen)}" style="cursor:pointer">
                  ${mini(s.screen, s.params ? s.params() : undefined, s.state || {})}
                </div>
                <div class="stepcap"><span class="n">${i + 1}</span>
                  <span><b>${esc(s.cap)}</b><span class="tap">${esc(s.tap)}</span></span></div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

export { Nav, Data };
