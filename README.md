# Booqable Operator Console — dashboard rebuild

A working, clickable reconstruction of the **Booqable back-office dashboard** as a rental
company's staff actually use it — web (Chrome) and the Mobile Point of Sale — built as a
set of ES modules over a registry, and bundled into one self-contained page.

This is not a set of screenshots or static mockups. Every screen is driven by the same
state: reserve an order and the calendar, availability matrix, dashboard counters and
reports all move with it. Pick an order up on the phone and the web view shows it as
*Picked up*.

```
src/                the web dashboard — core, schema, modules, data, styles
mobile/             the Android app — same domain, Material 3 UI
server/             Postgres schema, business rules in SQL, HTTP API, tests
build.mjs           zero-dependency bundler (serves both front ends)
dashboard.html      built web output      ·  android.html   built Android output
dev.html            src/ as native ES modules, no build step
ARCHITECTURE.md     how the modularity works and where each seam is
ANDROID.md          the 39-screen Android app
BACKEND.md          the database, the rules in SQL, and what it caught
DASHBOARD-MAP.md    the written functionality map: every screen, action and rule
```

## Running it

```bash
npm run build                  # rebuild dashboard.html and android.html
open dashboard.html            # no server needed

npm run db:reset && npm run api   # Postgres backend on :4000
npm test                          # 35 tests against a real database

python3 -m http.server 8080    # then open dev.html — unbundled ES modules
```

With the API running, point either front end at it from the console:

```js
await Booqable.useApi({ baseUrl: 'http://localhost:4000',
                        email: 'maya@northlightrentals.com',
                        password: 'northlight-dev' })
```

`dashboard.html` is the build output; edit the modules under `src/`, not that file.
It deliberately contains no `<html>`/`<head>`/`<body>` wrapper so it can be published
directly as a hosted page.

## What is in it

Eleven top-level sections, matching Booqable's own navigation order (frequently used at
the top, configuration at the bottom):

| Section | Route | What it covers |
|---|---|---|
| Dashboard | `#/dashboard` | Today's pickups and returns, overdue alerts, KPI tiles, day notes, activity |
| Orders | `#/orders` | Status-filtered list, search, bulk actions; full order detail |
| Calendar | `#/calendar` | Month grid of pickups/returns + a 14-day availability matrix |
| Documents | `#/documents` | Quotes, contracts, invoices, packing slips — preview, send, sign |
| Customers | `#/customers` | CRM profiles, history, discounts, tax profiles, custom fields |
| Products | `#/products` | Inventory, stock items, barcodes, pricing structures, downtime |
| Online store | `#/store` | Pages, theme, booking rules, checkout, domain & SEO |
| Reports | `#/reports` | Company, product, fulfilment, availability, customer, coupon |
| Apps | `#/apps` | Integrations and the REST resource map |
| Settings | `#/settings` | 18 panels across General, Selling, Operations, Communication, Account |
| Blueprint | `#/blueprint` | The map itself: screen inventory, state machine, data model, device parity |

Plus a **Mobile POS** mode (the `Web / Mobile POS` toggle in the top bar) rendering the
same live data in a phone frame, with date and status filters, per-order Pay / Pick up /
Return buttons, and a barcode scanner.

## What actually works

- **Full order lifecycle** — Concept → Reserved → Picked up → Mixed → Returned → Archived,
  plus Cancel and Revert, each with the correct effect on stock.
- **Real availability engine** — units owned, minus overlapping reservations, minus bundle
  contents, minus scheduled downtime, with buffer time widening every rental at both ends.
  Shortages are detected per line and blocked past the product's shortage limit.
- **Tiered pricing** — pricing structures (a 7-day hire charges ×3.5, not ×7), flat rates,
  fixed one-off services, sales items, and bundles.
- **Money** — subtotal → customer standing discount → coupon → tax profile (with exemption)
  → total → payments → outstanding, with security deposits held, captured or released
  separately.
- **Pickup and return flows** — choose which trackable stock items go out, capture a
  signature on canvas, withhold from the deposit on damage.
- **Documents** — generate, preview as the customer sees them, send, e-sign.
- **Everything writes to the activity log**, and the log is visible on the order and in
  Settings.

## How it is put together

Core knows the name of zero screens. Navigation comes from `Registry.modules()`,
every `data-act` dispatches through `Registry.runAction`, tables and forms render
from field schemas, the order workflow is a declarative state machine, and
availability and money are pipelines of registered rules.

| To change this… | Edit here | …and this follows automatically |
|---|---|---|
| Add a screen | `src/modules/<name>.js` | Sidebar entry, route, badge, actions, Blueprint card |
| Add a field | `src/schema/entities.js` | Table column, form control, document line, CSV export |
| Change the workflow | `src/schema/lifecycle.js` | Action bar, stepper, guards, POS buttons, Blueprint table |
| Add a pricing model | `Registry.pricingStrategy()` | Every product's pricing dropdown, all order totals |
| Add a stock constraint | `Registry.availabilityRule()` | Calendar, product page, shortages, pull sheet |
| Insert a charge or levy | `Registry.moneyStep()` | Order totals, invoices, the money breakdown |
| Add a document type | `Registry.documentType()` | Generate buttons, Documents tabs, templates, preview |
| Add a settings panel | `Registry.panel()` | The settings sidebar and its rendering |
| Point at the Postgres backend | `Store.init(ApiAdapter(…))` | Every screen, web and Android |
| Point at a live Booqable account | `Store.init(RestAdapter(…))` | Every screen, unchanged |

`ARCHITECTURE.md` has the detail. The **Blueprint** screen inside the app is
generated from the registry rather than describing it, so it cannot go stale.

## Design notes

- Deep-teal accent (`#0B7285`) chosen deliberately so it never collides with the reserved
  status hues: grey Concept, blue Reserved, amber Picked up, green Returned, purple Mixed,
  red Canceled/Overdue. Booqable swapped its *picked up* and *returned* colours in the
  redesign for exactly this reason — orange for "returned" fought orange for "unavailable".
- Archivo for display, IBM Plex Sans for UI, IBM Plex Mono for the things that are actually
  codes: SKUs, order numbers, barcodes, identifiers, money columns.
- Light and dark themes are both designed at token level, and the `◐` button in the top bar
  cycles light → dark → follow-system.

## Accuracy

Structure, terminology, statuses, and the settings taxonomy follow Booqable's own help
centre, glossary and API documentation. Company data (Northlight Rentals), products,
customers and orders are invented for the prototype.
