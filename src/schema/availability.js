/* Availability as a composable pipeline.

   Each rule receives a context { product, from, to, ignoreOrderId } and
   a running total, and returns how many units it removes. Adding a
   constraint — a sub-rental pool, a transfer in transit, a per-location
   split — is one Registry.availabilityRule() call; the engine and every
   screen that reads availability stay untouched. */

import { Registry } from '../core/registry.js';
import { Data } from '../core/store.js';
import { D, overlaps, startOfDay, addDays } from '../core/util.js';
import { Lifecycle } from './lifecycle.js';

export function registerAvailabilityRules() {
  Registry.availabilityRule({
    id: 'reservations', order: 10,
    label: 'units on reserved, picked-up and mixed orders whose period overlaps',
    deduct(ctx) {
      const holding = Lifecycle.holdingStates();
      const buffer = (ctx.product.buffer || 0) * 864e5;
      let q = 0;
      Data.orders().forEach(o => {
        if (o.id === ctx.ignoreOrderId || !holding.includes(o.status)) return;
        if (!overlaps(D(o.startsAt).getTime() - buffer, D(o.stopsAt).getTime() + buffer, ctx.from, ctx.to)) return;
        o.lines.forEach(l => {
          if (l.productId === ctx.product.id) q += l.qty - (l.returnedQty || 0);
        });
      });
      return q;
    }
  });

  Registry.availabilityRule({
    id: 'bundles', order: 20,
    label: 'units inside a bundle booked over the same window',
    deduct(ctx) {
      const holding = Lifecycle.holdingStates();
      const buffer = (ctx.product.buffer || 0) * 864e5;
      let q = 0;
      Data.orders().forEach(o => {
        if (o.id === ctx.ignoreOrderId || !holding.includes(o.status)) return;
        if (!overlaps(D(o.startsAt).getTime() - buffer, D(o.stopsAt).getTime() + buffer, ctx.from, ctx.to)) return;
        o.lines.forEach(l => {
          const bundle = l.productId && Data.product(l.productId);
          if (bundle?.bundle?.includes(ctx.product.id)) q += l.qty;
        });
      });
      return q;
    }
  });

  Registry.availabilityRule({
    id: 'downtime', order: 30,
    label: 'units in scheduled downtime (maintenance, repair, missing)',
    deduct(ctx) {
      return Data.downtime()
        .filter(d => d.productId === ctx.product.id && overlaps(d.from, d.to, ctx.from, ctx.to))
        .reduce((s, d) => s + d.qty, 0);
    }
  });

  Registry.availabilityRule({
    id: 'maintenance', order: 40,
    label: 'trackable units flagged for repair on the bench',
    deduct(ctx) {
      if (ctx.product.track !== 'trackable') return 0;
      return Data.stockItems().filter(si => si.productId === ctx.product.id && si.condition === 'maintenance').length;
    }
  });
}

export function availableQty(productId, from, to, ignoreOrderId) {
  const product = Data.product(productId);
  if (!product) return 0;
  const ctx = { product, from: D(from).getTime(), to: D(to).getTime(), ignoreOrderId };
  return Registry.availabilityRules().reduce((n, rule) => n - rule.deduct(ctx), product.stock);
}

export function availableOnDay(productId, date, ignoreOrderId) {
  const from = startOfDay(date);
  return availableQty(productId, from, addDays(from, 1), ignoreOrderId);
}

/* Per-line shortages, with the product's own allowance applied. */
export function orderShortages(order) {
  const out = [];
  order.lines.forEach(line => {
    if (!line.productId) return;
    const product = Data.product(line.productId);
    if (!product || product.type === 'sales' || product.type === 'service') return;
    const avail = availableQty(line.productId, order.startsAt, order.stopsAt, order.id);
    if (line.qty > avail) {
      const gap = line.qty - avail;
      out.push({ line, product, avail, gap, allowed: product.allowShortage && gap <= product.shortageLimit });
    }
  });
  return out;
}

/* Attach shortages so lifecycle guards can read them without importing
   this module — keeps the state machine free of availability knowledge. */
export function withShortages(order) {
  order.shortages = orderShortages(order);
  return order;
}

export const utilisationTone = (free, stock) =>
  free < 0 ? 'short'
    : stock === 0 ? 's0'
    : (() => {
        const pct = (stock - free) / stock;
        return pct === 0 ? 's0' : pct <= .25 ? 's1' : pct <= .5 ? 's2' : pct <= .75 ? 's3' : pct < 1 ? 's4' : 's5';
      })();
