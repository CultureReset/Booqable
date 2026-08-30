-- ============================================================
-- Booqable-style rental platform — core schema
--
-- Multi-tenant on account_id. Money is stored in integer cents,
-- never floats. Everything the UI treats as an entity has a table,
-- and the columns line up with src/schema/entities.js so the API
-- adapter is a rename, not a translation layer.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- tenancy ----------
create table accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  legal_name    text,
  email         text,
  phone         text,
  website       text,
  address       text,
  city          text,
  zip           text,
  country       text,
  vat_number    text,
  registration  text,
  currency      char(3) not null default 'USD',
  currency_symbol text not null default '$',
  timezone      text not null default 'UTC',
  date_format   text not null default 'MM/DD/YYYY',
  time_format   text not null default '12h',
  week_start    text not null default 'Monday',
  labels        jsonb not null default '{}'::jsonb,
  order_defaults jsonb not null default '{}'::jsonb,
  plan          text not null default 'Pro',
  order_sequence integer not null default 1000,
  created_at    timestamptz not null default now()
);

create table users (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  name          text not null,
  email         text not null,
  password_hash text,
  role          text not null default 'Operator'
                check (role in ('Owner','Operator','Warehouse','Finance')),
  twofa_enabled boolean not null default false,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
create unique index users_account_email_idx on users (account_id, lower(email));

create table sessions (
  token       text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  user_agent  text
);
create index on sessions (user_id);

-- ---------- reference data ----------
create table locations (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  code        text not null,
  kind        text not null default 'Pickup + inventory',
  address     text,
  is_main     boolean not null default false,
  unique (account_id, code)
);

create table tax_rates (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  kind        text not null default 'Regional',
  rate        numeric(6,3) not null default 0 check (rate >= 0 and rate <= 100)
);

create table tax_profiles (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false
);

create table tax_profile_rates (
  tax_profile_id uuid not null references tax_profiles(id) on delete cascade,
  tax_rate_id    uuid not null references tax_rates(id) on delete cascade,
  primary key (tax_profile_id, tax_rate_id)
);

create table collections (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  show_online boolean not null default true
);

create table pricing_structures (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  -- [{label, days, multiplier}] ordered ascending by days
  tiers       jsonb not null default '[]'::jsonb
);

create table coupons (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  code        text not null,
  kind        text not null check (kind in ('Percentage','Fixed')),
  value       numeric(10,2) not null,
  uses        integer not null default 0,
  use_limit   integer not null default 0,
  active      boolean not null default true,
  note        text,
  unique (account_id, code)
);

-- ---------- customers ----------
create table customers (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  number        text not null,
  kind          text not null default 'Company' check (kind in ('Company','Individual')),
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  address       text,
  city          text,
  zip           text,
  country       text,
  tags          text[] not null default '{}',
  discount_pct  numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  tax_profile_id uuid references tax_profiles(id) on delete set null,
  properties    jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (account_id, number)
);
create index on customers (account_id, lower(name));

-- ---------- catalogue ----------
create table products (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id) on delete cascade,
  sku            text not null,
  name           text not null,
  description    text,
  icon           text default '📦',
  product_type   text not null default 'rental'
                 check (product_type in ('rental','sales','service','bundle')),
  tracking       text not null default 'bulk' check (tracking in ('bulk','trackable')),
  collection_id  uuid references collections(id) on delete set null,
  location_id    uuid references locations(id) on delete set null,
  base_price_cents integer not null default 0 check (base_price_cents >= 0),
  price_period   text not null default 'day' check (price_period in ('day','week','order','once')),
  price_type     text not null default 'flat' check (price_type in ('flat','structure','fixed')),
  structure_id   uuid references pricing_structures(id) on delete set null,
  deposit_cents  integer not null default 0 check (deposit_cents >= 0),
  quantity       integer not null default 0 check (quantity >= 0),
  buffer_days    integer not null default 0 check (buffer_days >= 0),
  allow_shortage boolean not null default false,
  shortage_limit integer not null default 0 check (shortage_limit >= 0),
  tax_profile_id uuid references tax_profiles(id) on delete set null,
  tags           text[] not null default '{}',
  show_online    boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (account_id, sku)
);
create index on products (account_id, product_type);

create table bundle_items (
  bundle_id  uuid not null references products(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity   integer not null default 1 check (quantity > 0),
  primary key (bundle_id, product_id),
  check (bundle_id <> product_id)
);

create table stock_items (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  identifier  text not null,
  barcode     text not null,
  condition   text not null default 'good' check (condition in ('good','maintenance','lost')),
  location_id uuid references locations(id) on delete set null,
  note        text,
  unique (account_id, identifier),
  unique (account_id, barcode)
);
create index on stock_items (product_id);

create table downtime (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  starts_at   timestamptz not null,
  stops_at    timestamptz not null,
  reason      text,
  check (stops_at > starts_at)
);
create index on downtime (product_id, starts_at, stops_at);

-- ---------- orders ----------
create type order_status as enum
  ('concept','reserved','started','mixed','stopped','archived','canceled');

create table orders (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  number        integer not null,
  status        order_status not null default 'concept',
  customer_id   uuid not null references customers(id) on delete restrict,
  location_id   uuid references locations(id) on delete set null,
  starts_at     timestamptz not null,
  stops_at      timestamptz not null,
  source        text not null default 'Back office',
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  coupon_id     uuid references coupons(id) on delete set null,
  tags          text[] not null default '{}',
  properties    jsonb not null default '{}'::jsonb,
  signature_name text,
  signed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (account_id, number),
  check (stops_at > starts_at)
);
create index on orders (account_id, status);
create index on orders (account_id, starts_at, stops_at);

create table order_lines (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id) on delete cascade,
  order_id       uuid not null references orders(id) on delete cascade,
  product_id     uuid references products(id) on delete restrict,
  title          text not null,
  sku            text not null default '—',
  quantity       integer not null default 1 check (quantity > 0),
  price_each_cents integer not null default 0,
  tax_profile_id uuid references tax_profiles(id) on delete set null,
  picked_qty     integer not null default 0 check (picked_qty >= 0),
  returned_qty   integer not null default 0 check (returned_qty >= 0),
  note           text,
  position       integer not null default 0,
  check (picked_qty <= quantity),
  check (returned_qty <= picked_qty)
);
create index on order_lines (order_id);
create index on order_lines (product_id);

-- which physical units went out on which line
create table line_stock_items (
  line_id       uuid not null references order_lines(id) on delete cascade,
  stock_item_id uuid not null references stock_items(id) on delete cascade,
  primary key (line_id, stock_item_id)
);

-- ---------- money & paper ----------
create table payments (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  order_id     uuid not null references orders(id) on delete cascade,
  amount_cents integer not null,
  method       text not null,
  kind         text not null,
  status       text not null default 'Paid'
               check (status in ('Paid','Authorized','Released','Failed','Refunded')),
  paid_at      timestamptz not null default now()
);
create index on payments (order_id);

create table documents (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  order_id    uuid not null references orders(id) on delete cascade,
  doc_type    text not null check (doc_type in ('quote','contract','invoice','packing')),
  number      text not null,
  status      text not null default 'Draft',
  issued_at   timestamptz not null default now(),
  sent_to     text,
  signed_by   text,
  unique (account_id, number)
);
create index on documents (order_id);

create table notes (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  target      text not null check (target in ('order','customer','product','day')),
  target_id   text not null,
  body        text not null,
  author      text not null,
  created_at  timestamptz not null default now()
);
create index on notes (account_id, target, target_id);

create table activity (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  order_id    uuid references orders(id) on delete cascade,
  what        text not null,
  author      text not null,
  highlight   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on activity (account_id, created_at desc);
create index on activity (order_id);

-- ---------- account configuration ----------
create table custom_fields (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  entity      text not null check (entity in ('Order','Customer','Product')),
  label       text not null,
  field_type  text not null default 'Text',
  required    boolean not null default false,
  on_documents boolean not null default false
);

create table email_templates (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  kind        text not null default 'Automatic',
  trigger_on  text,
  subject     text not null,
  enabled     boolean not null default true
);

create table document_templates (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  doc_type    text not null check (doc_type in ('quote','contract','invoice','packing')),
  prefix      text not null,
  next_seq    integer not null default 1,
  terms       text,
  custom_css  boolean not null default false,
  unique (account_id, doc_type)
);

create table api_keys (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  token_hash  text not null,
  prefix      text not null,
  scopes      text not null default 'orders:read',
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create table webhooks (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  event       text not null,
  endpoint    text not null,
  active      boolean not null default true
);

-- keep orders.updated_at honest
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger orders_touch before update on orders
  for each row execute function touch_updated_at();
