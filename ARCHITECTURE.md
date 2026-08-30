# Architecture

The first cut of this app was one 3,500-line file: a `switch` for routing, an
18-branch `if/else` for settings panels, a ~200-case `switch` for actions, and
every table's columns baked into its own template literal. Adding a field meant
editing the form, the table, the document and the export separately. This is the
rewrite that fixed that.

The rule: **core knows the name of zero screens.** Everything specific arrives
through a registry at load time.

```
src/
  core/                    knows nothing about rentals
    registry.js            the seam — modules, actions, field types, rules
    store.js               entity access over a swappable adapter
    adapters/memory.js     in-memory (the seed)
    adapters/rest.js       Booqable REST — same interface
    fields.js              field types: view / edit / export
    view.js                DataTable · Form · FieldList · toCSV
    ui.js                  chips, cards, tiles, tabs, modal, toast, icons
    util.js                dates, money-free primitives
    app.js                 shell, routing, one delegated listener set
  schema/                  the domain, expressed as data
    entities.js            field schemas for every entity
    lifecycle.js           the order state machine
    pricing.js             pricing strategies + the money pipeline
    availability.js        the availability rule pipeline
    documents.js           document types
    settings.js            settings panels
  modules/                 one file per screen, each self-registering
    shell · dashboard · orders · calendar · documents · customers
    products · storefront · reports · apps · settings · blueprint · pos
  data/seed.js             pure data, no behaviour
  styles/*.css             tokens · shell · data · overlays
main.js                    composition root — the only file that knows it all exists
build.mjs                  zero-dependency bundler → dashboard.html
dev.html                   loads src/ as native ES modules, no build step
```

## The seams

**Screens.** A module is an object with `render()`, optional `detail()`,
`actions`, `badge()`, and an `order` that decides its sidebar position.
`app.js` builds navigation from `Registry.modules()` and dispatches every
`data-act` through `Registry.runAction`. Adding a screen touches one new file
and one import line in `main.js` — never the shell, the router, or the nav.

**Fields.** A field type declares how to *view*, *edit* and *export* a value.
Tables, forms, document lines and CSV all resolve through the same descriptor,
so a field is described once:

```js
{ key: 'deposit', label: 'Security deposit', type: 'money', group: 'pricing' }
```

That one line becomes a right-aligned currency table column, a number input in
the form, a row on the invoice, and a `deposit` column in the export.

**The lifecycle.** `schema/lifecycle.js` is a state machine, not code paths.
States declare `holdsStock`; transitions declare `from`, `to`, an optional
`guard`, `confirm`, `modal` or `log`. The order action bar is
`Lifecycle.available(order).map(...)`, the stepper is `Lifecycle.flow`, the POS
buttons read the same object, and the Blueprint's status table is generated
from it. Changing the workflow is editing that file.

**Availability.** A pipeline of registered rules, each subtracting from a
running total:

```js
Registry.availabilityRule({
  id: 'subrental', order: 15,
  label: 'units promised to a sub-rental partner',
  deduct: ctx => /* … */ 0
});
```

Every availability read — the calendar matrix, the product strip, per-line
shortages, the pull sheet — picks it up, and it appears in the Blueprint's
availability breakdown automatically.

**Money.** Ordered reducers from subtotal to total. Inserting a levy between the
coupon and the tax is one registration with `order: 35`; order totals, invoices
and the Blueprint all reflect it with no screen edit. (Verified in the test
suite by registering one at runtime and asserting it appears in both.)

**Settings.** Panels declare a `kind` — `form`, `table`, `switches`, or
`custom` — and four generic renderers cover all eighteen. No per-panel markup.

**Data source.** `Store` reads through an adapter. `MemoryAdapter` holds arrays;
`RestAdapter` maps Booqable API v1 resources, keeps a cache so the synchronous
UI still works, and writes optimistically. Swapping them is one line:

```js
await Booqable.useRest({ token: 'bq_live_…' })   // from the browser console
```

Field mapping between the wire shape and the internal shape lives only in
`rest.js`; screens never see `price_in_cents`.

## The Blueprint proves it

The Blueprint screen is generated *from* the registry rather than describing it.
Register a module, report, document type, availability rule or money step and it
appears there with no edit — which is the cheapest available proof that the
seams are real rather than decorative. The test suite registers all five at
runtime and asserts each one surfaces.

## Build

`build.mjs` has no dependencies. It walks the ES-module graph from `src/main.js`,
wraps each module in its own scope, wires imports as destructuring from the
modules they depend on, and emits `dashboard.html`. Module scoping is genuine:
three different screens each define a local `notesTab` and they do not collide,
exactly as under native modules.

```bash
node build.mjs                    # → dashboard.html
python3 -m http.server 8080       # then open dev.html for the unbundled sources
```

Both entry points were tested headlessly and produce byte-identical render
output across all 11 routes, 61 tabs, the full order lifecycle, documents,
payments and the POS.
