-- ============================================================
-- Authentication has a bootstrapping problem: to find out which
-- account a request belongs to you must first read `users`, but
-- `users` is behind row-level security keyed on that same account.
--
-- The fix is not to weaken the policy. It is two SECURITY DEFINER
-- functions with a deliberately narrow surface: one takes an email
-- and returns only the fields needed to verify a password, the
-- other exchanges a session token hash for its owner. Neither can
-- list users, and neither returns anything from another tenant
-- beyond the row that was asked for by exact key.
-- ============================================================

create or replace function auth_find_user(p_email text)
returns table (
  id uuid, account_id uuid, name text, email text,
  password_hash text, role text, twofa_enabled boolean, account_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.account_id, u.name, u.email, u.password_hash,
         u.role, u.twofa_enabled, a.name
  from users u
  join accounts a on a.id = u.account_id
  where lower(u.email) = lower(p_email)
  limit 1
$$;

create or replace function auth_touch_user(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update users set last_seen_at = now() where id = p_user
$$;

create or replace function auth_resolve_session(p_token_hash text)
returns table (
  account_id uuid, user_id uuid, name text, email text, role text, expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.account_id, u.id, u.name, u.email, u.role, s.expires_at
  from sessions s
  join users u on u.id = s.user_id
  where s.token = p_token_hash
  limit 1
$$;

-- only the API role may call them; they are not public utilities
revoke execute on function auth_find_user(text) from public;
revoke execute on function auth_touch_user(uuid) from public;
revoke execute on function auth_resolve_session(text) from public;
grant execute on function auth_find_user(text) to booqable_api;
grant execute on function auth_touch_user(uuid) to booqable_api;
grant execute on function auth_resolve_session(text) to booqable_api;

-- the api role writes its own sessions, so it needs the sequence-free grants
grant select, insert, delete on sessions to booqable_api;
