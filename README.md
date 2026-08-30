# Booqable Operator Console — dashboard rebuild

A working, clickable reconstruction of the **Booqable back-office dashboard** as a rental
company's staff actually use it — web (Chrome) and the Mobile Point of Sale — built as a
single self-contained HTML file with a live in-memory data model behind it.

This is not a set of screenshots or static mockups. Every screen is driven by the same
state: reserve an order and the calendar, availability matrix, dashboard counters and
reports all move with it. Pick an order up on the phone and the web view shows it as
*Picked up*.

```
dashboard.html      the whole application — open it in a browser, no build step
DASHBOARD-MAP.md    the written functionality map: every screen, action and rule
```

## Running it

Open `dashboard.html` in any modern browser. There is no server, no bundler, no install.
It is also publishable as-is (the file deliberately contains no `<html>`/`<head>`/`<body>`
wrapper so it can be hosted directly).

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
