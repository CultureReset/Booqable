# Northlight for Android

The whole rental platform as a Material 3 Android app — the operator side and the
renter side — with every screen reachable and working.

```bash
node build.mjs --entry mobile/main.js --styles mobile/styles \
  --out android.html --title "Northlight for Android" \
  --fonts "family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500"
```

**39 screens · 6 end-to-end flows · 5 bottom-nav tabs · 0 duplicated business logic.**

## What it actually is

A working app, not a set of mockups. It shares the entire domain layer with the web
dashboard by importing it directly:

```
mobile/main.js
  ├─ ../src/core/store.js          same Store, same adapter
  ├─ ../src/schema/lifecycle.js    same order state machine
  ├─ ../src/schema/pricing.js      same tiered pricing + money pipeline
  ├─ ../src/schema/availability.js same 4-rule availability engine
  ├─ ../src/schema/entities.js     same field schemas
  └─ ../src/schema/settings.js     same 18 settings panels
```

Pick an order up on the phone and the web dashboard shows it as *Picked up*. Register a
new settings panel and it appears in the Android settings list. That is the payoff of the
registry refactor: a second front end, no second copy of the rules.

Only the UI layer is new:

```
mobile/
  styles/   01-m3-tokens.css     Material 3 tonal palettes, light + dark + Material You
            02-m3-components.css the Android widget vocabulary
            03-shell.css         the page around the device
  core/     m3.js                app bars, list items, chips, sheets, FABs, switches…
            nav.js               per-tab back stacks, overlays, snackbars
  screens/  auth · today · orders · catalog · more · shop
  flows.js  6 journeys, each frame a live screen
  store.js  the Google Play submission surface
```

## The four modes

| Mode | What it gives you |
|---|---|
| **App** | The device, fully interactive, with a live back-stack breadcrumb beside it |
| **Screens** | All 39 screens rendered at once, grouped — "every layout, all angles" |
| **Flows** | 6 journeys step by step, each frame rendered from the live screen |
| **Play Store** | Listing, assets, permissions, Data safety, technical targets, readiness |

Plus Phone / Fold / Tablet, Light / Dark / Auto, and a Material You toggle showing the
palette Android would extract from the wallpaper.

## Screen inventory

**Onboarding (5)** splash · signin · twofa · workspace · permissions
**Today (3)** today · notifications · search
**Orders (7)** orders · order · pickup · signature · return · orderNew · itemPicker
**Scan (2)** scan · scanResult
**Catalog (3)** catalog · product · stock
**More (14)** more · customers · customer · calendar · documents · document · reports ·
storefront · settings · settingsPanel · team · profile · sync · about
**Customer app (5)** shopHome · shopProduct · shopCart · shopCheckout · shopBookings

## Android patterns, deliberately

- **Per-tab back stacks.** Each bottom-nav destination keeps its own history. System back
  pops that stack, then falls back to Today — the Android convention, not a browser stack.
- **Bottom action bars.** The one action that matters (Pick up, Return, Checkout) sits in
  thumb reach, never in the app bar.
- **Bottom sheets over dialogs.** Dialogs are reserved for destructive confirmation.
- **Snackbars with Undo**, not toasts.
- **Permissions asked in context** with a rationale screen first — nothing at launch.
- **Large/collapsing app bars** on top-level destinations, small ones on detail screens.
- **A tab destination never hides the bottom nav.** (The scanner originally did; it trapped
  the user, and the fix is in the commit history.)
- **Offline is a first-class screen**, because warehouses have bad signal.

## What is real and what is not

**Real and verified:** every screen renders with live data; the full pickup and return
flows mutate the same store the dashboard reads; payments, documents, signatures, scanning,
theming, adaptive widths and the back stack all work. Tested headlessly — 39/39 screens,
6 flows, zero runtime errors, both themes.

**Not done, and why:** there is no signed `.aab`. This container has Java and Gradle but no
Android SDK, no `kotlinc`, no emulator — so a Kotlin/Compose build could be written but not
compiled or run, and shipping unverifiable build output would be worse than saying so. The
three open items on the Play Store tab all need an SDK, an upload key and a Play Console
account.

What this **is** good for: it is the complete, agreed UI/UX and interaction spec. Every
screen, state, transition, empty state and permission moment is decided and demonstrated,
which is the part that normally takes the longest and causes the most rework.
