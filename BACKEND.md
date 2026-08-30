# Backend

A real Postgres backend: schema, business rules in SQL, row-level security,
a token-auth HTTP API, and an adapter that moves both front ends onto it.

```bash
npm run db:reset     # drop, migrate, seed the demo account
npm run api          # http://localhost:4000
npm run test:api     # 26 integration tests against a real database
npm run test:e2e     # the front-end adapter against the running API
```

Sign in with `maya@northlightrentals.com` / `northlight-dev`.

## Why any of this is in the database

The browser cannot stop two operators reserving the last camera at the same
moment. That is the whole reason a backend exists here, so availability,
pricing and the lifecycle guards are implemented in SQL and called inside a
locked transaction — not reimplemented in JavaScript on the server.

```
server/
  migrations/
    001_schema.sql          26 tables, money in integer cents, FK-complete
    002_logic.sql           availability, charge units, totals, transitions
    003_rls.sql             row-level security on every tenant table
    004_auth_functions.sql  narrow SECURITY DEFINER functions for sign-in
  lib/
    db.js       pooling, per-request tenant scoping, migrations
    auth.js     scrypt passwords, sessions, role capabilities
    seed.js     loads the demo account from src/data/seed.js
    api.js      routes as data — method, path, capability, handler
  index.js      node:http server, no framework
  test.js       integration tests
  e2e.js        the ApiAdapter driving the real API
```

## The rules that live in SQL

| Function | What it guarantees |
|---|---|
| `available_qty(product, from, to, ignore)` | Units owned, minus overlapping reservations (widened by buffer time), minus bundle contents, minus downtime, minus units on the bench. The same four rules as the client — authoritative. |
| `charge_units(product, from, to)` | Tiered pricing: the largest tier the duration reaches. A 7-day hire is ×3.5, not ×7. |
| `order_totals(order)` | Subtotal → customer discount → coupon → tax, in integer cents. |
| `derive_status(order)` | Status follows fulfilment counts, so it can never disagree with the lines. |
| `reserve_order(order)` | Locks the order, then every product on it in id order, **then** re-checks shortages, then flips the status. This is the one that stops the double-booking. |
| `fulfil_lines(order, moves, kind)` | Pickup and return, clamped so you cannot return more than went out. |

## Tenancy

Every tenant table has `account_id`, RLS enabled *and forced*, and a policy
comparing it to `current_account_id()`. The API sets that per request with
`set_config('app.account_id', …, true)` inside the transaction, so a forgotten
`WHERE` clause cannot leak another tenant's rows — a test asserts exactly that.

`current_account_id()` also reads a Supabase JWT claim, so the same schema and
policies work deployed to Supabase with no API server at all.

Sign-in has a bootstrapping problem: you must read `users` before you know the
account, but `users` is behind that policy. The fix is not to weaken it — it is
two `SECURITY DEFINER` functions with a deliberately narrow surface
(`auth_find_user`, `auth_resolve_session`) that can only be reached by exact key.

## Auth and roles

scrypt with parameters stored alongside each hash. Sign-in always runs a verify,
even for an unknown email, so response time does not enumerate accounts. Session
tokens are stored as SHA-256 hashes, never in the clear.

Role capabilities are enforced server-side, not just hidden in the UI:

| | Owner | Operator | Warehouse | Finance |
|---|---|---|---|---|
| read orders | ● | ● | ● | ● |
| write orders | ● | ● | — | — |
| pick up / return | ● | ● | ● | — |
| take payment | ● | ● | — | ● |
| change settings | ● | — | — | — |

## Connecting a front end

```js
await Booqable.useApi({
  baseUrl: 'http://localhost:4000',
  email: 'maya@northlightrentals.com',
  password: 'northlight-dev'
});
```

`ApiAdapter` implements the same interface as `MemoryAdapter`. One
`/api/bootstrap` call primes a cache so the synchronous UI keeps working;
reserve, pickup, return and payment go straight to the server and **can reject** —
"someone took the last one" has to reach the user, so those return promises.

## What the database caught

Two real bugs that the browser demo never surfaced, because nothing was
enforcing anything:

1. **21 of 41 stock barcodes collided.** The generator truncated a hash to nine
   digits. Scanning would have been ambiguous. Replaced with sequential EAN-13s
   with valid check digits; a test now asserts both properties.
2. **A 4–6 day hire was billed at the month rate.** The client picked pricing
   tiers by array position, so once the list ran out a 6-day rental charged ×10
   instead of ×2.2 — a 4.5× overcharge. The SQL picked the largest tier that
   fits; the e2e test compared the two and the disagreement surfaced it. Both
   engines now use explicit day thresholds.

That is the argument for the backend in one paragraph.

## Test coverage

26 integration tests + 9 end-to-end. The ones worth naming:

- two simultaneous reservations of the last unit — exactly one wins
- RLS hides another account from both the API and a direct query
- a Warehouse role can fulfil but is refused a payment
- withholding from a deposit captures that much and releases the rest
- refusing to withhold more than is held
- tiered pricing bills a week at the structure multiplier
- the client and server pricing pipelines agree on a live order
- the client and server availability engines agree
- the lifecycle config and the database enum describe the same states
- a server refusal reaches the caller instead of being swallowed

## Not done

- No hosted deployment. It runs locally against Postgres 16; the migrations are
  Supabase-ready but nothing has been pushed to a hosted project.
- Payments are recorded, not processed — no Stripe integration.
- Emails and webhooks are modelled but not sent.
- No rate limiting or audit retention policy yet.
