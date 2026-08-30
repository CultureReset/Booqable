# Booqable dashboard — complete functionality map

Every section of the rental company's back office, what lives in it, and what it does.
Written as a build spec: if you implement everything below, you have the dashboard.

Sources for structure and terminology: Booqable's help centre collections, the glossary,
the order-workflow article, and the public API v1 resource list.

---

## 0. Shell

**Left sidebar**, ordered by how often staff touch it — this order is Booqable's own:

```
[ + New order ]              ← a shortcut, not a nav item; always first
Dashboard
Orders
Calendar
──────────── Manage
Documents
Customers
Products
──────────── Grow
Online store
Reports
Apps
──────────── Account
Settings
```

Badges: overdue count on Orders, overdue invoices on Documents, today's movements on
Dashboard.

**Top bar**: global search (orders, customers, products, **barcodes**), location switcher
for multi-location accounts, device toggle (Web / Mobile POS), theme toggle, user menu.

Global search resolves in this order: stock-item barcode or identifier → order number →
customer name → product name/SKU → otherwise fall through to a filtered order list.

---

## 1. Dashboard — `#/dashboard`

The daily rental organiser. It answers one question: *what happens today?*

| Element | Behaviour |
|---|---|
| Period selector | Today / Tomorrow / Next 7 days / Next 30 days (Booqable also allows a custom range from a calendar) |
| Pickups panel | Reserved orders starting in the window, plus any whose start time has passed — those flag as **late pickup** |
| Returns panel | Picked-up and Mixed orders due back in the window, plus anything past its return time — flags as **overdue** |
| KPI tiles | Out today · Back today · Open orders · Booked value · Outstanding |
| Alert banners | Overdue returns, late pickups, and any open order carrying a stock shortage |
| Run report | Jumps to the printable product-fulfilment report (the pull sheet) for the same window |
| Notes for the day | Free-text notes for the crew — not attached to any order |
| Recent activity | The account-wide activity log, newest first, each entry linking to its order |

Hovering an order row reveals the link into the full order.

---

## 2. Orders — `#/orders`

### List

- **Status tabs**: Open · All · Concepts · Reserved · Picked up · Returned · Overdue ·
  Archived · Canceled, each with a live count.
- **Search** across order number, customer, product name and SKU.
- **Columns**: order #, customer, status chip, rental period, item count, source, total, due.
  Overdue and shortage badges render inline on the row.
- **Bulk select** → archive, add tag. (Booqable also offers bulk delete and bulk export.)
- **Export CSV.**

### Order detail — `#/orders/:id`

**Header**: order number, status chip, overdue badge, tags, customer, rental period, day
count, location. **Action bar** varies by status:

| Status | Actions offered |
|---|---|
| Concept | Reserve · Cancel · Duplicate · Documents |
| Reserved | Pick up · Cancel · Revert to concept · Duplicate · Documents |
| Picked up / Mixed | Return · Pick up more · Revert · Duplicate · Documents |
| Returned | Archive · Revert · Duplicate · Documents |
| Archived | Reopen · Duplicate |
| Canceled | Duplicate |

**Status stepper**: Concept → Reserved → Picked up → Returned → Archived, with Mixed shown
as a side state and Canceled as a terminal branch.

**Tabs**

1. **Items & pricing** — every line shows quantity (editable), fulfilment state
   (`n out` / `n back`) with the specific stock-item identifiers used, price each, the
   charge multiplier applied, and the line total. Per line it also shows how many units are
   free for those exact dates, and flags a shortage in red. Below: add product, add custom
   line, apply coupon, set security deposit. Totals block: subtotal → customer discount →
   coupon → tax → total → paid → outstanding, with the deposit listed separately.
2. **Documents** — generate a quote, contract, invoice or packing slip; preview each as the
   customer sees it; send by email; collect an e-signature on the contract.
3. **Payments** — register a payment (card, cash, bank transfer, cheque, Tap to Pay),
   request a payment link, hold a security deposit, capture or release a held deposit.
   Partial payments are first-class.
4. **Notes** — internal only; the customer never sees them.
5. **Activity** — every status change, payment, document and edit, with actor and timestamp.
6. **Custom fields** — whatever the account defined for orders.

**Sidebar**: customer card (with standing discount and tax-exempt flags), editable rental
period, fulfilment counts, location, signature, and the money summary with a *New payment*
button.

**Pickup modal** — tick which lines go out and how many; for trackable products choose the
specific stock items (or scan their barcodes); capture a signature. A partial pickup leaves
the order **Mixed**.

**Return modal** — tick what came back; enter an amount to withhold from the deposit and a
damage note. Withholding captures that much of the hold; otherwise the hold is released.

---

## 3. Calendar — `#/calendar`

- **Orders view** — Monday-first month grid. Each order appears twice: `↑` on its pickup
  day, `↓` on its return day, coloured by status, red when overdue. Month stepping and a
  *Today* button.
- **Availability view** — a 14-day matrix, one row per rental product, each cell the number
  of units still bookable that day, shaded light→dark as it fills up, outlined red when
  overbooked.

---

## 4. Documents — `#/documents`

Four document types, all generated from orders: **quote, contract, invoice, packing slip**.

- Tiles: total documents, contracts awaiting signature, overdue invoices, unpaid value.
- Tabs by type, plus an Overdue tab.
- Columns: number, type, order, customer, status, date, amount.
- Statuses: Draft · Sent · Accepted · Signed · Paid · Partially paid · Overdue · Printed.
- Preview renders the real document — company letterhead, bill-to block, rental period,
  line table, totals, terms from the template, and signature blocks on contracts. Packing
  slips drop prices and add a check column instead.
- Numbering, terms and custom CSS are configured in Settings → Document templates.

---

## 5. Customers — `#/customers`

- List with lifetime value and outstanding balance per customer.
- **Detail tabs**: Orders · Documents · Notes · Profile & fields.
- Profile carries: type (individual/company), contact, email, phone, address, **standing
  discount %** applied to every new order, **tax profile** (including exempt), tags, and
  custom fields.
- Sidebar shows contact details, custom fields, and the customer's most-rented products.
- *New order* from the customer page pre-fills them.

---

## 6. Products — `#/products`

### List
List or grid view. Tabs: All · Rentals · Sales items · Services · Bundles · Shortages ·
In maintenance. Search by name, SKU or barcode. Collection filters.
Columns: product, type, tracking method, collection, units owned, free today, price, deposit.

### Detail tabs

1. **General** — name, SKU, type, collection, home location, tags, description shown on
   documents and the store, bundle contents, variations.
2. **Pricing** — base price, charge period (day/week/order/once), pricing type
   (**flat** = price × days, **structure** = tiered multipliers, **fixed** = charged once),
   security deposit, tax profile. Shows a worked table of what each duration actually costs
   and the effective per-day rate.
3. **Inventory** — for **trackable** products, every stock item with its identifier,
   generated barcode, in-stock/out status, condition, location and note; add items, print
   labels, send a unit to the bench. For **bulk** products, just a quantity.
4. **Availability** — buffer time (days blocked before and after every rental), allow-
   shortage toggle and shortage limit, a 21-day strip of free units, scheduled downtime
   (maintenance, repair, missing), and the list of open orders holding the product.
5. **Online store** — visibility, live availability display, price display, store URL,
   SEO title and description.
6. **Notes** — internal notes on the product.

### Tracking methods
- **Bulk** — count only; you know you own 24 C-stands, not which one went where.
- **Trackable** — each unit has an identifier and barcode, and its own history.

---

## 7. Online store — `#/store`

- **Pages** — website-builder pages with paths and publish state; collections shown in the
  catalog.
- **Theme** — active theme, accent colour, fonts, corner radius, and the ordered list of
  home-page sections. Live storefront preview.
- **Booking rules** — min/max rental duration, lead time before pickup, default pickup and
  return times, how far ahead customers may book, operating hours per weekday, **away mode**,
  and whether shortage-causing bookings are blocked.
- **Checkout** — require an account, pay now, pay later, security deposit, delivery,
  custom checkout fields, cross-sell items.
- **Domain & SEO** — custom domain, Booqable subdomain, store title, meta description,
  XML sitemap, password protection, URL redirects.

---

## 8. Reports — `#/reports`

| Report | Contents |
|---|---|
| Company performance | 12-month revenue chart, order count, average order, repeat rate, orders by status, and where orders come from (back office / online store / mobile POS) |
| Product performance | Revenue share, orders, units out, rental days, revenue, utilisation % per product |
| Product fulfilment | The **pull sheet** — what to pick for a chosen window, with checkboxes, quantity needed vs free, and which orders each line belongs to. Printable. |
| Availability | The same 14-day matrix as the calendar |
| Customers | Lifetime value, order count, average order, outstanding, customer since |
| Coupons | Code, type, value, uses, limit, active state |

All exportable as CSV; the fulfilment report and documents are printable.

---

## 9. Apps — `#/apps`

Connect/disconnect Zapier, QuickBooks, Google Analytics 4, Mailchimp, Xero, Slack.
Includes the REST resource map so integrators can see what each screen maps to:

| Resource | What it is in the UI |
|---|---|
| `orders` | An order and its status |
| `lines` | Rows on the order |
| `plannings` | The reservation itself — what consumes availability |
| `product_groups` | A product |
| `products` | A variation of a product |
| `items` | A trackable stock item |
| `customers` | A customer profile |
| `documents` | Quote / contract / invoice |
| `payments` | Money against an order |

---

## 10. Settings — `#/settings`

**General** — Company information (name, legal entity, contact, address, VAT/registration,
logo — all printed on documents) · Date, time & locale (currency, date and time format,
timezone, week start, language) · Account labels (rename "Customer" to "Client" or
"Student") · Locations (pickup + inventory, or inventory-only).

**Selling** — Pricing defaults and pricing-structure templates · Tax rates (regional,
compound, exempt) and tax profiles · Coupons · Payment providers (Stripe incl. Tap to Pay,
manual/offline, PayPal) and deposit behaviour.

**Operations** — Order defaults (default pickup/return times, number prefix, next number,
require signature, warn on shortages, auto-archive) · Custom fields for orders, customers
and products · Tags and collections.

**Communication** — Email templates: automatic (order confirmation, payment receipt,
pickup reminder, return reminder, overdue notice) and manual (quote follow-up, damage
report), with a variable reference · Document templates: numbering scheme, next number,
terms per type, custom CSS.

**Account** — Team & permissions with a role capability matrix (Owner / Operator /
Warehouse / Finance) · Security (enforce 2FA, SSO, IP restrictions, export logging) ·
API keys and webhooks · Activity log · Plan & billing with the feature comparison.

---

## 11. Mobile Point of Sale

Same account, different job. Warehouse staff move equipment; they do not price it.

- **Dashboard** filtered by Today / Tomorrow / Upcoming / Late, with status labels
  All orders / To pick up / To return / Shortage, and a location switcher.
- **Per-order buttons**: a blue **Pay** showing the outstanding amount (white "Paid" when
  settled) and an amber **Pick up** or green **Return**. Late orders also offer Cancel.
- **Search** by order number, customer or product.
- **Scanner** for QR codes and barcodes on orders, customers and stock items.
- **Signature** capture on pickup.
- **Deliberately absent**: pricing changes, reports, settings, document templates, team
  management. Those live on the web.

---

## Rules that the whole system depends on

### Order statuses

| Status | Stock is… | Meaning |
|---|---|---|
| New | not held | Being typed. No number yet, nothing saved. |
| Concept | not held | A draft or unapproved quote. Anyone else can still book the gear. |
| Reserved | held for the period | Committed. Blocks other bookings. |
| Picked up | out with the customer | Physically gone. |
| Mixed | partly out | Some lines back, some still out. |
| Returned | back in stock | Available again; money may still be owed. |
| Archived | free | Closed and filed. Still searchable and reportable. |
| Canceled | free | Called off. Only reachable from New, Concept or Reserved. |

### Availability

```
available(product, from, to) =
    units owned
  − units on reserved / picked-up / mixed orders whose period overlaps
  − units inside a bundle booked over the same window
  − units in scheduled downtime
      …where every rental is widened by its buffer time at both ends
```

A shortage is not automatically an error: if the product allows shortages, a booking may
exceed stock up to its shortage limit — on the assumption that you will sub-rent or borrow
in time. Past that limit the order is blocked.

### Money, in order

```
1. line charge = quantity × price each × charge units
     charge units come from the pricing structure —
     a 7-day hire is ×3.5, not ×7
2. subtotal    = sum of every line
3. − customer standing discount (%)
4. − coupon (percentage or fixed)
5. + tax at the customer's tax profile rate (0% if exempt)
6. = total  ·  − payments received  =  outstanding
     the security deposit sits outside this:
     held, then captured or released
```
