-- ============================================================
-- Business rules that must not live only in the client.
--
-- Two operators can hit "reserve" on the last camera at the same
-- moment. The browser cannot prevent that; a transaction can. So
-- availability, pricing and the lifecycle guards are implemented
-- here and the API calls them inside a locked transaction.
-- ============================================================

-- statuses that consume stock
create or replace function holding_statuses() returns order_status[]
language sql immutable as $$ select array['reserved','started','mixed']::order_status[] $$;

-- rental duration in days, inclusive, minimum one
create or replace function rental_days(starts timestamptz, stops timestamptz)
returns integer language sql immutable as $$
  select greatest(1, ceil(extract(epoch from (stops - starts)) / 86400.0)::int)
$$;

-- ---------------------------------------------------------------
-- charge units: how many "days" a hire is actually billed for.
-- Mirrors src/schema/pricing.js — flat multiplies by days, a
-- structure picks the largest tier that fits, fixed charges once.
-- ---------------------------------------------------------------
create or replace function charge_units(p_product uuid, p_starts timestamptz, p_stops timestamptz)
returns numeric language plpgsql stable as $$
declare
  prod   products%rowtype;
  d      integer := rental_days(p_starts, p_stops);
  mult   numeric;
begin
  select * into prod from products where id = p_product;
  if not found then return d; end if;
  if prod.price_period in ('once','order') or prod.price_type = 'fixed' then
    return 1;
  end if;
  if prod.price_type = 'flat' or prod.structure_id is null then
    return d;
  end if;
  select (tier->>'multiplier')::numeric into mult
  from pricing_structures ps, jsonb_array_elements(ps.tiers) tier
  where ps.id = prod.structure_id and (tier->>'days')::int <= d
  order by (tier->>'days')::int desc
  limit 1;
  return coalesce(mult, d);
end $$;

-- ---------------------------------------------------------------
-- available_qty: the same four-rule pipeline the front ends run,
-- but authoritative. Every rule is a subtraction from units owned.
-- ---------------------------------------------------------------
create or replace function available_qty(
  p_product uuid,
  p_from    timestamptz,
  p_to      timestamptz,
  p_ignore_order uuid default null
) returns integer language plpgsql stable as $$
declare
  prod      products%rowtype;
  buffer    interval;
  reserved  integer := 0;
  bundled   integer := 0;
  down      integer := 0;
  bench     integer := 0;
begin
  select * into prod from products where id = p_product;
  if not found then return 0; end if;
  buffer := make_interval(days => prod.buffer_days);

  -- 1. units booked directly on overlapping orders that hold stock
  select coalesce(sum(l.quantity - l.returned_qty), 0) into reserved
  from order_lines l
  join orders o on o.id = l.order_id
  where l.product_id = p_product
    and o.status = any (holding_statuses())
    and (p_ignore_order is null or o.id <> p_ignore_order)
    and (o.starts_at - buffer) < p_to
    and p_from < (o.stops_at + buffer);

  -- 2. units consumed inside a bundle booked over the same window
  select coalesce(sum(l.quantity * bi.quantity), 0) into bundled
  from order_lines l
  join orders o on o.id = l.order_id
  join bundle_items bi on bi.bundle_id = l.product_id
  where bi.product_id = p_product
    and o.status = any (holding_statuses())
    and (p_ignore_order is null or o.id <> p_ignore_order)
    and (o.starts_at - buffer) < p_to
    and p_from < (o.stops_at + buffer);

  -- 3. scheduled downtime
  select coalesce(sum(d.quantity), 0) into down
  from downtime d
  where d.product_id = p_product
    and d.starts_at < p_to and p_from < d.stops_at;

  -- 4. trackable units sitting on the bench
  if prod.tracking = 'trackable' then
    select count(*) into bench from stock_items
    where product_id = p_product and condition <> 'good';
  end if;

  return prod.quantity - reserved - bundled - down - bench;
end $$;

-- shortages on an order, one row per offending line
create or replace function order_shortages(p_order uuid)
returns table (line_id uuid, product_id uuid, product_name text,
               booked integer, available integer, gap integer, allowed boolean)
language sql stable as $$
  select l.id, p.id, p.name, l.quantity, a.avail,
         l.quantity - a.avail,
         p.allow_shortage and (l.quantity - a.avail) <= p.shortage_limit
  from order_lines l
  join orders o on o.id = l.order_id
  join products p on p.id = l.product_id
  cross join lateral (select available_qty(l.product_id, o.starts_at, o.stops_at, o.id) as avail) a
  where l.order_id = p_order
    and p.product_type not in ('sales','service')
    and l.quantity > a.avail
$$;

-- ---------------------------------------------------------------
-- order_totals: the money pipeline, in the same order the client
-- shows it — subtotal, customer discount, coupon, tax.
-- All integer cents; rounding happens once, at each step.
-- ---------------------------------------------------------------
create or replace function order_totals(p_order uuid)
returns table (
  subtotal_cents integer, customer_discount_cents integer, coupon_cents integer,
  tax_rate numeric, tax_cents integer, total_cents integer,
  paid_cents integer, due_cents integer, deposit_cents integer, held_deposit_cents integer
) language plpgsql stable as $$
declare
  o          orders%rowtype;
  cust       customers%rowtype;
  sub        integer := 0;
  cdisc      integer := 0;
  cpn        integer := 0;
  rate       numeric := 0;
  taxable    integer := 0;
  tax        integer := 0;
  tot        integer := 0;
  paid       integer := 0;
  held       integer := 0;
  coup       coupons%rowtype;
begin
  select * into o from orders where id = p_order;
  if not found then return; end if;
  select * into cust from customers where id = o.customer_id;

  select coalesce(sum(round(l.quantity * l.price_each_cents
                            * charge_units(l.product_id, o.starts_at, o.stops_at)))::int, 0)
    into sub
  from order_lines l where l.order_id = p_order;

  cdisc := round(sub * coalesce(cust.discount_pct, 0) / 100.0)::int;

  if o.coupon_id is not null then
    select * into coup from coupons where id = o.coupon_id;
    if found then
      cpn := case when coup.kind = 'Percentage'
                  then round((sub - cdisc) * coup.value / 100.0)::int
                  else round(coup.value * 100)::int end;
    end if;
  end if;

  taxable := sub - cdisc - cpn;

  select coalesce(sum(tr.rate), 0) into rate
  from tax_profile_rates tpr join tax_rates tr on tr.id = tpr.tax_rate_id
  where tpr.tax_profile_id = cust.tax_profile_id;

  tax := round(taxable * rate / 100.0)::int;
  tot := taxable + tax;

  select coalesce(sum(amount_cents), 0) into paid from payments
  where order_id = p_order and status = 'Paid' and kind <> 'Security deposit hold';
  select coalesce(sum(amount_cents), 0) into held from payments
  where order_id = p_order and status = 'Authorized' and kind = 'Security deposit hold';

  return query select sub, cdisc, cpn, rate, tax, tot, paid, tot - paid, o.deposit_cents, held;
end $$;

-- ---------------------------------------------------------------
-- derive_status: fulfilment counts decide the picked-up band, so
-- the status can never disagree with the lines.
-- ---------------------------------------------------------------
create or replace function derive_status(p_order uuid) returns order_status
language plpgsql stable as $$
declare
  cur order_status;
  t integer; pk integer; rt integer;
begin
  select status into cur from orders where id = p_order;
  if cur in ('canceled','archived','concept') then return cur; end if;
  select coalesce(sum(quantity),0), coalesce(sum(picked_qty),0), coalesce(sum(returned_qty),0)
    into t, pk, rt from order_lines where order_id = p_order;
  if t > 0 and rt >= t then return 'stopped'; end if;
  if t > 0 and pk >= t and rt = 0 then return 'started'; end if;
  if pk > 0 and (rt > 0 or pk < t) then return 'mixed'; end if;
  if pk > 0 then return 'started'; end if;
  return 'reserved';
end $$;

-- ---------------------------------------------------------------
-- reserve_order: the transition that must not race.
--
-- Locks every product on the order in a stable order (id) so two
-- concurrent reservations serialise rather than deadlock, re-checks
-- availability under the lock, and only then flips the status.
-- ---------------------------------------------------------------
create or replace function reserve_order(p_order uuid)
returns table (ok boolean, message text) language plpgsql as $$
declare
  o       orders%rowtype;
  bad     record;
begin
  select * into o from orders where id = p_order for update;
  if not found then return query select false, 'Order not found'; return; end if;
  if o.status not in ('concept') then
    return query select false, format('Cannot reserve an order that is %s', o.status); return;
  end if;

  -- lock the catalogue rows this order touches, lowest id first
  perform 1 from products
   where id in (select distinct product_id from order_lines
                where order_id = p_order and product_id is not null)
   order by id
   for update;

  select * into bad from order_shortages(p_order) where not allowed limit 1;
  if found then
    return query select false,
      format('%s is short %s beyond its limit', bad.product_name, bad.gap);
    return;
  end if;

  update orders set status = 'reserved' where id = p_order;
  insert into activity (account_id, order_id, what, author, highlight)
  values (o.account_id, p_order, 'Status changed to Reserved', 'System', true);
  return query select true, 'reserved'::text;
end $$;

-- fulfilment: pick up / return specific quantities, then re-derive
create or replace function fulfil_lines(p_order uuid, p_moves jsonb, p_kind text)
returns table (ok boolean, moved integer, status order_status)
language plpgsql as $$
declare
  o      orders%rowtype;
  mv     jsonb;
  ln     order_lines%rowtype;
  n      integer := 0;
  q      integer;
  st     order_status;
begin
  select * into o from orders where id = p_order for update;
  if not found then return query select false, 0, null::order_status; return; end if;

  for mv in select * from jsonb_array_elements(p_moves) loop
    select * into ln from order_lines
      where id = (mv->>'line')::uuid and order_id = p_order for update;
    continue when not found;
    q := coalesce((mv->>'qty')::int, 0);
    if p_kind = 'pickup' then
      q := least(q, ln.quantity - ln.picked_qty);
      if q > 0 then
        update order_lines set picked_qty = picked_qty + q where id = ln.id;
        n := n + q;
      end if;
    else
      q := least(q, ln.picked_qty - ln.returned_qty);
      if q > 0 then
        update order_lines set returned_qty = returned_qty + q where id = ln.id;
        n := n + q;
      end if;
    end if;
  end loop;

  st := derive_status(p_order);
  update orders set status = st where id = p_order;
  return query select true, n, st;
end $$;
