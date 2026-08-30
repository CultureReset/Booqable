/* Pricing and money as pipelines.

   `chargeUnits` dispatches to a registered strategy, so a new pricing
   model is one Registry.pricingStrategy() call. The order total is an
   ordered list of reducers — insert a step (an eco levy, a rush
   surcharge) by registering it with an `order`, without touching the
   engine or any screen. */

import { Registry } from '../core/registry.js';
import { Data } from '../core/store.js';
import { daysBetween, sum } from '../core/util.js';

export function registerPricingStrategies() {
  /* charged once regardless of duration — services, sales items */
  Registry.pricingStrategy('fixed', () => 1);

  /* price × number of days */
  Registry.pricingStrategy('flat', (product, order) =>
    (product.period === 'once' || product.period === 'order') ? 1 : daysBetween(order.startsAt, order.stopsAt));

  /* tiered multipliers: a 7-day hire is ×3.5, not ×7 */
  Registry.pricingStrategy('structure', (product, order) => {
    const days = daysBetween(order.startsAt, order.stopsAt);
    const st = Data.pricingStructures().find(s => s.id === product.structure);
    if (!st) return days;
    if (days >= 30) return st.rows[st.rows.length - 1].mult;
    if (days >= 7) return (st.rows.find(r => /Week/i.test(r.label)) || { mult: days }).mult;
    return (st.rows[Math.min(days - 1, st.rows.length - 1)] || { mult: days }).mult;
  });
}

export function chargeUnits(product, order) {
  if (!product) return daysBetween(order.startsAt, order.stopsAt);
  if (product.period === 'once' || product.period === 'order') return 1;
  const strategy = Registry.getPricingStrategy(product.priceType) || Registry.getPricingStrategy('flat');
  return strategy(product, order);
}

export function lineUnits(line, order) {
  if (line.kind === 'custom') return 1;
  return chargeUnits(line.productId ? Data.product(line.productId) : null, order);
}

export function lineTotal(line, order) {
  return line.qty * line.priceEach * lineUnits(line, order);
}

export function taxRateFor(profileId) {
  const tp = Data.taxProfiles().find(t => t.id === profileId) || Data.taxProfiles()[0];
  if (!tp) return 0;
  return sum(tp.rates, rid => Data.taxRates().find(r => r.id === rid)?.rate || 0);
}

/* --- the money pipeline --- */
export function registerMoneySteps() {
  Registry.moneyStep({
    id: 'subtotal', order: 10, label: 'Subtotal',
    apply: ctx => { ctx.subtotal = sum(ctx.order.lines, l => lineTotal(l, ctx.order)); ctx.running = ctx.subtotal; }
  });

  Registry.moneyStep({
    id: 'customerDiscount', order: 20, label: 'Customer discount', kind: 'deduction',
    apply: ctx => {
      const pct = ctx.customer?.discount || 0;
      ctx.customerDiscount = ctx.subtotal * (pct / 100);
      ctx.running -= ctx.customerDiscount;
    },
    visible: ctx => ctx.customerDiscount > 0,
    amount: ctx => -ctx.customerDiscount
  });

  Registry.moneyStep({
    id: 'coupon', order: 30, label: 'Coupon', kind: 'deduction',
    apply: ctx => {
      const c = Data.coupons().find(x => x.id === ctx.order.couponId);
      ctx.coupon = c || null;
      ctx.couponDiscount = !c ? 0
        : c.kind === 'Percentage' ? ctx.running * (c.value / 100) : c.value;
      ctx.running -= ctx.couponDiscount;
    },
    visible: ctx => !!ctx.coupon,
    amount: ctx => -ctx.couponDiscount
  });

  Registry.moneyStep({
    id: 'tax', order: 40, label: 'Tax', kind: 'addition',
    apply: ctx => {
      const profile = ctx.customer?.taxProfile || ctx.order.lines[0]?.taxProfile;
      ctx.taxRate = taxRateFor(profile);
      ctx.taxable = ctx.running;
      ctx.tax = ctx.taxable * (ctx.taxRate / 100);
      ctx.running += ctx.tax;
    },
    amount: ctx => ctx.tax,
    labelFor: ctx => `Tax ${ctx.taxRate ? `(${ctx.taxRate}%)` : '(exempt)'}`
  });
}

export function orderTotals(order) {
  const ctx = {
    order,
    customer: Data.customer(order.customerId),
    subtotal: 0, running: 0
  };
  Registry.moneySteps().forEach(step => step.apply(ctx));
  ctx.total = ctx.running;

  const payments = Data.payments().filter(p => p.orderId === order.id);
  ctx.paid = sum(payments.filter(p => p.kind !== 'Security deposit hold' && p.status === 'Paid'), p => p.amount);
  ctx.heldDeposit = sum(payments.filter(p => p.kind === 'Security deposit hold' && p.status === 'Authorized'), p => p.amount);
  ctx.due = ctx.total - ctx.paid;
  ctx.deposit = order.deposit || 0;

  /* rows the totals block renders, straight from the pipeline */
  ctx.rows = Registry.moneySteps()
    .filter(s => s.visible ? s.visible(ctx) : true)
    .map(s => ({
      id: s.id,
      label: s.labelFor ? s.labelFor(ctx) : s.label,
      amount: s.amount ? s.amount(ctx) : ctx[s.id]
    }));
  return ctx;
}
