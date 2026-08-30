-- ============================================================
-- Row-level security.
--
-- Every tenant table carries account_id, and every policy compares
-- it to the account on the current connection. The API sets that
-- with `set_config('app.account_id', …, true)` inside the request
-- transaction, so a query can never reach another tenant's rows
-- even if a WHERE clause is forgotten.
--
-- Supabase-compatible: if a JWT is present its `account_id` claim
-- is used, so the same policies work when this schema is deployed
-- there with no API server at all.
-- ============================================================

create or replace function current_account_id() returns uuid
language plpgsql stable as $$
declare
  from_setting text := current_setting('app.account_id', true);
  from_jwt     text;
begin
  if from_setting is not null and from_setting <> '' then
    return from_setting::uuid;
  end if;
  begin
    from_jwt := current_setting('request.jwt.claims', true)::json->>'account_id';
  exception when others then
    from_jwt := null;
  end;
  if from_jwt is not null and from_jwt <> '' then
    return from_jwt::uuid;
  end if;
  return null;
end $$;

-- role the API connects as: subject to RLS, unlike the owner
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'booqable_api') then
    create role booqable_api login password 'api-dev-password';
  end if;
end $$;

do $$
declare
  t text;
  tenant_tables text[] := array[
    'locations','tax_rates','tax_profiles','collections','pricing_structures','coupons',
    'customers','products','stock_items','downtime','orders','order_lines','payments',
    'documents','notes','activity','custom_fields','email_templates','document_templates',
    'api_keys','webhooks','users'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($f$
      create policy %1$s_tenant on %1$I
        using (account_id = current_account_id())
        with check (account_id = current_account_id())
    $f$, t);
    execute format('grant select, insert, update, delete on %I to booqable_api', t);
  end loop;

  -- accounts: a session may only see its own
  alter table accounts enable row level security;
  alter table accounts force row level security;
  create policy accounts_tenant on accounts
    using (id = current_account_id()) with check (id = current_account_id());
  grant select, update on accounts to booqable_api;

  -- join tables inherit their parent's account through the FK
  alter table tax_profile_rates enable row level security;
  create policy tpr_tenant on tax_profile_rates using (
    exists (select 1 from tax_profiles tp
            where tp.id = tax_profile_id and tp.account_id = current_account_id()));
  grant select, insert, update, delete on tax_profile_rates to booqable_api;

  alter table bundle_items enable row level security;
  create policy bundle_tenant on bundle_items using (
    exists (select 1 from products p
            where p.id = bundle_id and p.account_id = current_account_id()));
  grant select, insert, update, delete on bundle_items to booqable_api;

  alter table line_stock_items enable row level security;
  create policy lsi_tenant on line_stock_items using (
    exists (select 1 from order_lines l
            where l.id = line_id and l.account_id = current_account_id()));
  grant select, insert, update, delete on line_stock_items to booqable_api;
end $$;

-- sessions are looked up before an account is known, so they are
-- reachable by the api role but carry no cross-tenant data
grant select, insert, delete on sessions to booqable_api;
grant usage on schema public to booqable_api;
grant execute on all functions in schema public to booqable_api;
