/* The order lifecycle as data.

   States declare whether they hold stock; transitions declare where they
   run from, what they do to the lines, and when they are allowed. The
   action bar, the stepper, the Blueprint table and the POS buttons are
   all derived from this object — changing the workflow means editing
   here and nowhere else. */

import { Data, Store } from '../core/store.js';
import { sum } from '../core/util.js';

export const Lifecycle = {
  initial: 'new',

  /* The happy path, used for the stepper. States outside it (mixed,
     canceled) render as branches. */
  flow: ['concept', 'reserved', 'started', 'stopped', 'archived'],

  states: {
    new:      { label: 'New',       tone: 'new',      holdsStock: false, stockNote: 'not held',
                hint: 'Not saved yet — no number assigned.',
                meaning: 'Being typed. No number assigned, nothing saved.' },
    concept:  { label: 'Concept',   tone: 'concept',  holdsStock: false, stockNote: 'not held',
                hint: 'Saved as a draft. Nothing is reserved.',
                meaning: 'A draft or an unapproved quote. Anyone else can still book the same gear.' },
    reserved: { label: 'Reserved',  tone: 'reserved', holdsStock: true,  stockNote: 'held for the period',
                hint: 'Stock is held for the rental period.',
                meaning: 'Committed. Blocks other bookings and counts against availability.' },
    started:  { label: 'Picked up', tone: 'started',  holdsStock: true,  stockNote: 'out with the customer',
                hint: 'Items are with the customer.',
                meaning: 'Physically gone. Counts as unavailable until it comes back.' },
    mixed:    { label: 'Mixed',     tone: 'mixed',    holdsStock: true,  stockNote: 'partly out',
                hint: 'Some items out, some already back.',
                meaning: 'Some lines back, some still out. Common on multi-day strikes.' },
    stopped:  { label: 'Returned',  tone: 'stopped',  holdsStock: false, stockNote: 'back in stock',
                hint: 'Everything is back in stock.',
                meaning: 'Returned and available again. Money may still be owed.' },
    archived: { label: 'Archived',  tone: 'archived', holdsStock: false, stockNote: 'free',
                hint: 'Closed out and filed away.',
                meaning: 'Closed and filed. Still searchable and reportable.' },
    canceled: { label: 'Canceled',  tone: 'canceled', holdsStock: false, stockNote: 'free',
                hint: 'Called off — nothing is held.',
                meaning: 'Called off. Nothing held, nothing owed.' }
  },

  /* order matters: it is the order buttons appear in the action bar */
  transitions: [
    { id: 'reserve',   label: 'Reserve order',  from: ['new', 'concept'],              to: 'reserved', cls: 'primary',
      guard: o => blockingShortage(o), log: 'Status changed to Reserved' },
    { id: 'pickup',    label: 'Pick up items',  from: ['reserved'],                    to: 'started',  cls: 'pick',  modal: 'pickup' },
    { id: 'pickupMore',label: 'Pick up more',   from: ['started', 'mixed'],            to: null,       cls: '',      modal: 'pickup' },
    { id: 'return',    label: 'Return items',   from: ['started', 'mixed'],            to: 'stopped',  cls: 'ret',   modal: 'return' },
    { id: 'archive',   label: 'Archive order',  from: ['stopped'],                     to: 'archived', cls: 'primary',
      log: 'Order archived' },
    { id: 'reopen',    label: 'Reopen',         from: ['archived'],                    to: 'stopped',  cls: '',
      log: 'Order reopened' },
    { id: 'documents', label: 'Documents ▾',    from: ['concept', 'reserved', 'started', 'mixed', 'stopped'], to: null, cls: '', tab: 'documents' },
    { id: 'duplicate', label: 'Duplicate',      from: '*',                             to: null,       cls: '' },
    { id: 'cancel',    label: 'Cancel',         from: ['new', 'concept', 'reserved'],  to: 'canceled', cls: 'danger',
      confirm: o => `Cancel order #${o.number}? Stock is released immediately.`, log: 'Order canceled' },
    { id: 'revert',    label: 'Revert ↩',       from: ['reserved', 'started', 'mixed', 'stopped'], to: 'back', cls: 'ghost',
      title: 'Step the order back one stage' }
  ],

  /* where "revert" lands, and what it undoes on the lines */
  reverts: {
    reserved: { to: 'concept', clear: [] },
    started:  { to: 'reserved', clear: ['pickedQty', 'returnedQty', 'stockItemIds'] },
    mixed:    { to: 'reserved', clear: ['pickedQty', 'returnedQty', 'stockItemIds'] },
    stopped:  { to: 'started',  clear: ['returnedQty'] },
    archived: { to: 'stopped',  clear: [] }
  },

  /* actions offered per state, for the Blueprint reference table */
  actionsFor(stateId) {
    return Lifecycle.transitions
      .filter(t => t.from === '*' || t.from.includes(stateId))
      .map(t => t.label.replace(/ ▾| ↩/, ''));
  },
  available(order) {
    return Lifecycle.transitions.filter(t => t.from === '*' || t.from.includes(order.status));
  },
  state: id => Lifecycle.states[id] || Lifecycle.states.new,
  label: id => Lifecycle.state(id).label,
  tone: id => Lifecycle.state(id).tone,
  holdingStates: () => Object.entries(Lifecycle.states).filter(([, s]) => s.holdsStock).map(([id]) => id)
};

/* Status is derived from fulfilment counts, never set by hand for the
   picked-up/mixed/returned band. */
export function deriveStatus(order) {
  if (['canceled', 'archived', 'concept', 'new'].includes(order.status)) return order.status;
  const total = sum(order.lines, l => l.qty);
  const picked = sum(order.lines, l => l.pickedQty || 0);
  const returned = sum(order.lines, l => l.returnedQty || 0);
  if (total > 0 && returned >= total) return 'stopped';
  if (total > 0 && picked >= total && returned === 0) return 'started';
  if (picked > 0 && (returned > 0 || picked < total)) return 'mixed';
  if (picked > 0) return 'started';
  return 'reserved';
}

/* Guards return a reason string to block, or null to allow. */
function blockingShortage(order) {
  const blocking = (order.shortages || []).filter(s => !s.allowed);
  return blocking.length
    ? `${blocking[0].product.name} is short ${blocking[0].gap} beyond its limit`
    : null;
}

export function applyTransition(order, transition, { onLog } = {}) {
  const target = transition.to === 'back'
    ? Lifecycle.reverts[order.status]?.to
    : transition.to;
  if (!target) return order;

  if (transition.to === 'back') {
    const rule = Lifecycle.reverts[order.status];
    order.lines.forEach(l => rule.clear.forEach(k => { l[k] = Array.isArray(l[k]) ? [] : 0; }));
  }
  order.status = target;
  Store.changed('orders');
  if (onLog) onLog(transition.log || `Status changed to ${Lifecycle.label(target)}`);
  return order;
}

export const isLatePickup = o => o.status === 'reserved' && new Date(o.startsAt) < new Date();
export const isLateReturn = o => ['started', 'mixed'].includes(o.status) && new Date(o.stopsAt) < new Date();
export const isLate = o => isLatePickup(o) || isLateReturn(o);
export const totalItems = o => sum(o.lines, l => l.qty);
export const pickedItems = o => sum(o.lines, l => l.pickedQty || 0);
export const returnedItems = o => sum(o.lines, l => l.returnedQty || 0);
export const openOrders = () => Data.orders().filter(o => Lifecycle.state(o.status).holdsStock);
