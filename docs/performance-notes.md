# Performance notes

Two pieces of performance work are recorded here. The first is a defect found in
this codebase, diagnosed and fixed. The second is a design decision that was
measured rather than assumed.

All numbers below were produced on this machine by the commands shown. Where a
figure could not be measured, that is stated instead of estimated.

---

## 1. `@ngrx/store-devtools` was shipped to production

### What was wrong

`app.config.ts` registered the Redux DevTools bridge like this:

```ts
provideStoreDevtools({
  maxAge: 25,
  logOnly: !isDevMode(),
  connectInZone: false,
}),
```

`logOnly: !isDevMode()` makes the instrumentation passive in production, which
is the commonly recommended pattern — but it does nothing about the bundle. The
`import` is unconditional, so the entire devtools package stayed in the
production `main` chunk and was downloaded and evaluated by every visitor.

### How it was identified

Bundle inspection of a real production build:

```bash
npx ng build
grep -l "REDUX_DEVTOOLS\|store-devtools" dist/kiboGoods/browser/*.js
# -> main-3X4SYAMB.js
```

The Angular CLI build output was used for the sizes; no third-party analyser was
needed because the CLI already reports per-chunk raw and transfer sizes.

### Before

```
main-3X4SYAMB.js    | main          |  30.61 kB |  9.61 kB transfer
                    | Initial total | 355.58 kB | 100.26 kB transfer
```

`grep` confirmed devtools identifiers present in `main`.

### What changed

A runtime guard is not sufficient — `isDevMode()` is evaluated at runtime, so
the bundler must keep the import. This was confirmed by trying it:
switching to `isDevMode() ? provideStoreDevtools(...) : []` left the `main`
chunk at 30.60 kB and `grep` still found devtools in the output.

The fix is a build-time file replacement, so the production build never
references the package at all:

- `src/app/core/devtools/devtools.providers.ts` — provides the devtools.
- `src/app/core/devtools/devtools.providers.prod.ts` — exports an empty array.
- `angular.json` swaps the two under the `production` configuration via
  `fileReplacements`.

### After

```
main-RPSPXII3.js    | main          |  19.27 kB |  6.05 kB transfer
                    | Initial total | 341.82 kB | 95.96 kB transfer
```

`grep -l "REDUX_DEVTOOLS\|store-devtools" dist/kiboGoods/browser/*.js` now
returns nothing.

| Metric                   | Before    | After     | Change            |
| ------------------------ | --------- | --------- | ----------------- |
| `main` chunk (raw)       | 30.61 kB  | 19.27 kB  | −11.34 kB (−37%)  |
| `main` chunk (transfer)  | 9.61 kB   | 6.05 kB   | −3.56 kB (−37%)   |
| Initial total (raw)      | 355.58 kB | 341.82 kB | −13.76 kB (−3.9%) |
| Initial total (transfer) | 100.26 kB | 95.96 kB  | −4.30 kB (−4.3%)  |

### Why this improves the application

The saving is on the critical path: `main` is parsed and executed before the
first route renders, so the cost is not only 3.6 kB of transfer but the parse
and evaluation of a module that instrumented every dispatched action. Removing
instrumentation also removes the action-history retention (`maxAge: 25`) that
otherwise held references to 25 past states for the lifetime of the tab.

### Trade-offs and what remains

- DevTools are now unavailable in a production build. That is the intent, but it
  does mean a production-only state bug cannot be inspected with the Redux
  extension; it would have to be reproduced against a development build.
- `fileReplacements` is compile-time magic: someone reading
  `devtools.providers.ts` alone cannot see that production behaves differently.
  The file carries a comment pointing here for that reason.
- The remaining 341 kB initial bundle is dominated by the Angular framework plus
  NgRx (`chunk-*.js`, 309.77 kB raw / 85.33 kB transfer). That is the floor for
  this stack and was not pursued further.
- **Not measured:** Lighthouse scores and field metrics (LCP, INP, TBT). No
  Lighthouse run is included because this environment has no Chrome UI available
  to produce a trustworthy result, and a fabricated score would be worse than
  none. The methodology, if run: `npx lighthouse http://localhost:4300
--preset=desktop --only-categories=performance`, three runs, median reported,
  against a production build served statically rather than `ng serve`.

---

## 2. Cart-quantity lookup in the product grid — measured, not assumed

### The question

Every card in the grid needs to know how many of _that_ product are already in
the cart, so it can show a quantity stepper instead of "Add to cart". With a
24-card grid and a shopper pressing `+` twenty times, how much work does the
grid do?

Two designs were considered:

- **A selector factory per card** — `selectCartQuantityFor(id)` called from the
  template. This is the idiomatic-looking option and reads well.
- **One memoised map** — `selectCartQuantityById` produces a
  `ReadonlyMap<number, number>` once per cart change; each card does an O(1)
  `get`.

### How it was measured

`src/app/features/cart/store/cart.selectors.bench.spec.ts` builds both
selectors, wraps each projector in a counter, and replays the scenario (24
cards, 20 increments). Run with:

```bash
npm run test:ci -- --filter="cart quantity lookup"
```

### Result

| Design                     | Projector executions | Cart scans |
| -------------------------- | -------------------- | ---------- |
| One memoised map (shipped) | 20                   | 20         |
| Selector factory per card  | 480                  | 480        |

The factory is 24× the work, and the multiplier is the grid size — it gets worse
as the catalogue page grows. The reason is that calling a factory from a
template allocates a **new** selector instance on every change-detection pass,
so NgRx's memoisation cache is new each time and never hits.

A third case in the same spec confirms the shipped design's other benefit: 50
reads of an unchanged cart cost exactly **1** projector execution, so renders
triggered by unrelated state (a theme change, a route change) do no cart work at
all.

### Why this matters beyond the raw count

Building the map once also gives every card a **referentially stable** number.
Because `ProductCardComponent` is `OnPush` and takes `quantityInCart` as an
input, pressing `+` on one card marks only that card dirty — the other 23 keep
their previous input value and are skipped. With the factory design each card
received a freshly computed value each pass, which defeats that entirely.

### Trade-off

The map is rebuilt in full on every cart change, which is O(lines) allocation
even when a single quantity changed. For a shopping cart — tens of lines at
most — that is far cheaper than the alternative. If cart lines ever reached the
thousands, an entity-adapter dictionary read directly (no `Map` copy) would be
the next step.

---

## 3. Smaller measures applied throughout

These were designed in rather than fixed after the fact, so no before/after
numbers exist for them:

- **Zoneless change detection** (`provideZonelessChangeDetection()`), so change
  detection is driven by signals and events rather than by patched async APIs.
- **`ChangeDetectionStrategy.OnPush` on every component**, without exception.
- **Route-level code splitting** — each page is a `loadComponent`; the cart,
  checkout and confirmation screens are not in the initial download. Confirmed
  in the build output as separate `cart-page`, `checkout-page`,
  `product-detail` and `order-completed-page` chunks.
- **`track` on every `@for`**, keyed by product id, so re-rendering a filtered
  grid reuses DOM nodes instead of recreating them.
- **Filtering and sorting in memoised selectors**, never in templates.
- **A no-op reducer returns the previous state object** (`withItems`), which
  both preserves referential equality for `OnPush` and — the reason it was
  found — stops a pointless `localStorage` write on every no-op action.
- **Image strategy**: fixed `aspect-ratio` boxes to prevent layout shift, the
  first four cards eager with `fetchpriority="high"` to protect the largest
  paint, everything below the fold `loading="lazy"`.
- **A single `preconnect`** to the API origin, so the catalogue request does not
  pay for DNS and TLS after the bundle parses.
