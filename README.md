# Kibo Goods

A curated storefront built on the [Fake Store API](https://fakestoreapi.com):
browse and filter a catalogue, manage a cart that survives a reload, and check
out through to a confirmation screen.

![Angular 21](https://img.shields.io/badge/Angular-21-DD0031) ![NgRx 21](https://img.shields.io/badge/NgRx-21-BA2BD2) ![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6)

---

## Quick start

```bash
npm install
npm start          # http://localhost:4200
```

> **Node and npm.** Requires Node `>=22.12` and **npm `>=11`** to _resolve_
> this tree: npm 9 and 10 crash during `npm install` with
> `Cannot read properties of null (reading 'edgesOut')`, a known arborist bug
> rather than a lockfile problem. If your npm is older, `npx npm@11 install`
> works without changing your global install.
>
> **`npm ci` works on npm 10 and above**, because it installs from the lockfile
> instead of resolving. CI runs Node 24, which bundles npm 11.

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `npm start`       | Dev server with HMR                              |
| `npm run build`   | Production build to `dist/kiboGoods`             |
| `npm test`        | Unit and integration tests, watch mode           |
| `npm run test:ci` | Single run with coverage and enforced thresholds |
| `npm run e2e`     | Playwright E2E (starts the app itself)           |
| `npm run lint`    | ESLint over TypeScript and templates             |
| `npm run format`  | Prettier                                         |

For E2E on a fresh machine: `npx playwright install chromium`.

---

## Tech stack

| Package                 | Version | Why                                                             |
| ----------------------- | ------- | --------------------------------------------------------------- |
| Angular                 | 21.2    | Standalone components, signals, zoneless change detection       |
| NgRx Store / Effects    | 21.1    | Shared state — see [ADR-001](docs/adr-001-state-management.md)  |
| RxJS                    | 7.8     | Effect concurrency, debounced search                            |
| TypeScript              | 5.9     | `strict`, plus `noPropertyAccessFromIndexSignature` and friends |
| Vitest                  | 4.1     | Angular 21's default unit-test runner                           |
| Playwright              | 1.63    | End-to-end, desktop and mobile viewports                        |
| ESLint + angular-eslint | 9 / 21  | Includes template accessibility rules                           |
| SCSS                    | —       | Design tokens + a small global primitive layer                  |

**Angular 21, not 22, is deliberate.** Angular 22 requires Node `^22.22.3`, and
this environment runs Node 22.22.1 — the CLI refuses to scaffold. 21.2 is the
latest stable release that runs here.

---

## Architecture

Feature-oriented, and consistent across all three features: every feature owns
its `store/`, `pages/`, `components/` and `models/`, and nothing reaches into
another feature's store folder except through its public selectors and actions.

```
src/
├── app/
│   ├── core/                      # cross-cutting, app-wide singletons
│   │   ├── models/                # Product, AppError
│   │   ├── services/              # ProductApiService, Storage, Theme, Toast, error mapping
│   │   ├── interceptors/          # single retry for idempotent GETs
│   │   ├── guards/                # orderPlacedGuard
│   │   ├── tokens/                # API_BASE_URL
│   │   ├── devtools/              # dev-only store instrumentation (see perf notes)
│   │   └── utils/                 # product parser (validation), money helpers
│   │
│   ├── shared/components/         # presentational, feature-agnostic
│   │   ├── app-header/  icon/  star-rating/  quantity-stepper/
│   │   ├── product-image/  empty-state/  error-state/  toast-host/
│   │
│   ├── features/
│   │   ├── products/  { store/ pages/ components/ }
│   │   ├── cart/      { store/ pages/ components/ models/ services/ }
│   │   └── checkout/  { store/ pages/ models/ }
│   │
│   ├── app.routes.ts              # every route lazy-loaded
│   └── app.config.ts              # providers, store registration, persistence
│
├── styles/                        # _tokens.scss, _base.scss, _ui.scss
└── testing/                       # fixtures + in-memory localStorage
```

Data flows one way:

```
Component  ──dispatch──▶  Action  ──▶  Reducer  ──▶  State
    ▲                        │                          │
    └────── Selector ◀───────┴──── Effect ──▶ ProductApiService ──▶ Fake Store API
```

Components never call `HttpClient`. Only `ProductApiService` knows the wire
format, and everything it returns has been validated (see Security).

### Component conventions

Applied uniformly, no exceptions:

- Standalone, `ChangeDetectionStrategy.OnPush`, signal `input()`/`output()`.
- **Pages** read the store and dispatch. **Components** take inputs and emit
  outputs, and never inject the store — which is what makes them cheap to test
  and cheap to render.
- Business logic lives in reducers, selectors and `core/utils`; templates
  display, they do not compute.

---

## State management

Three slices, all registered at bootstrap (the _components_ are what lazy-load):

| Slice      | Holds                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `products` | Catalogue, load status, error, active query (search / category / sort / paging), product detail |
| `cart`     | Cart lines, one per product                                                                     |
| `checkout` | Submission state and the last placed order                                                      |

Cart totals exist **only** as selectors — `selectCartSubtotal`,
`selectCartTotalQuantity`, `selectCartQuantityById` — so the header, product
grid, cart page and checkout physically cannot disagree. All money arithmetic
goes through `core/utils/money.ts` in integer cents.

**Persistence.** The cart is written to `localStorage` under `kibo.cart.v1` by a
meta-reducer, so persistence happens at the state boundary and cannot drift from
the state it mirrors. Everything read back is validated field by field before it
is allowed to become state — see [security notes](docs/security-notes.md).

Rationale and the alternatives weighed: **[ADR-001](docs/adr-001-state-management.md)**.

### Cart edge cases

| Case                                        | Behaviour                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Adding a product already in the cart        | Quantity increments; never a second line                                                              |
| Rapid repeated clicks                       | Each reduction is a pure function of the previous state, so no update can be lost to a stale snapshot |
| Decrement at quantity 1                     | Held at 1; the control becomes an explicit "remove" instead                                           |
| Quantity ceiling                            | 99 per line, a UI guard against stuck key-repeat                                                      |
| No-op action                                | Returns the _same_ state object — preserves `OnPush` skipping and avoids a pointless storage write    |
| Tampered / malformed saved cart             | Valid lines kept, invalid dropped, absurd quantities clamped, app never crashes                       |
| Product no longer in the API                | The cart line carries its own snapshot, so it still renders and can still be removed                  |
| Storage unavailable (private mode, blocked) | Reads return `null`, writes are ignored; the app runs without persistence                             |

---

## API

`GET https://fakestoreapi.com/products` and `/products/:id`. No key, no auth.

The response is treated as untrusted input. `parseProduct` validates every field
and returns `null` for anything unusable; `parseProducts` keeps the good entries
and discards the rest, so one malformed record cannot empty the storefront.
Image URLs are resolved through the `URL` constructor and only `http(s)` is
accepted.

Categories and their counts are derived from the catalogue rather than fetched
separately — one request, and counts that always agree with what is on screen.

`API_BASE_URL` is an injection token, so tests and future environments can swap
the endpoint without touching the service.

---

## Routes

| Route              | Screen                                                  |
| ------------------ | ------------------------------------------------------- |
| `/`                | Catalogue — search, filter, sort, paging                |
| `/products/:id`    | Product detail                                          |
| `/cart`            | Cart                                                    |
| `/checkout`        | Shipping form and order summary                         |
| `/order-completed` | Confirmation — guarded, redirects home without an order |
| `**`               | Redirects to `/`                                        |

---

## Testing

175 unit/integration tests and 18 E2E tests (9 specs × desktop and mobile
viewports). Coverage on 2026-09-18: **86.3% statements, 90.1% branches, 85.3%
functions, 85.3% lines**, with thresholds enforced at 80/75.

```bash
npm run test:ci                    # coverage summary in the terminal
open coverage/index.html           # full HTML report
npm run e2e
```

Strategy, the coverage rationale, how the tests were kept honest, and one edge
case deliberately **not** implemented (authoritative stock):
**[docs/testing-notes.md](docs/testing-notes.md)**.

---

## Performance

One real defect was found and fixed: `@ngrx/store-devtools` was being shipped in
the production bundle. A build-time file replacement removed it —
`main` chunk **30.61 kB → 19.27 kB** raw (−37%), initial transfer
**100.26 kB → 95.96 kB**.

A second decision — how the grid looks up per-product cart quantities — was
measured rather than assumed: one memoised map costs **20** selector executions
where a per-card selector factory costs **480**.

Method, numbers, trade-offs and what was _not_ measured:
**[docs/performance-notes.md](docs/performance-notes.md)**.

Also applied throughout: zoneless change detection, `OnPush` everywhere,
route-level code splitting, `track` on every list, memoised selectors,
`aspect-ratio` image boxes to prevent layout shift, eager loading only for
above-the-fold images.

---

## Accessibility

- Semantic landmarks (`header` / `main`), one `h1` per page,
  ordered headings.
- A skip link, and `main` is focus-targetable.
- Buttons for actions, links for navigation — never the reverse.
- Every input has a real `<label>`; errors use `aria-invalid` +
  `aria-describedby`, and a failed submit moves focus to the first invalid field.
- Icon-only buttons carry visually-hidden text; icons themselves are
  `aria-hidden`.
- Loading uses `role="status"`, failures `role="alert"`, toasts a polite live
  region.
- Visible focus rings via `:focus-visible`, 44px minimum touch targets,
  `prefers-reduced-motion` respected.
- `angular-eslint`'s template-accessibility rules run in `npm run lint`, and an
  E2E test completes a keyboard-only journey from the skip link to the cart.

---

## Security

`npm audit`: **0 vulnerabilities** across 694 packages (2026-09-18), re-run in
CI. No `innerHTML`, no `DomSanitizer`, no third-party scripts, no secrets, no
card data collected, no customer PII persisted.

Full threat model, the `localStorage` tampering matrix, and the gaps stated
rather than hidden: **[docs/security-notes.md](docs/security-notes.md)**.

---

## Design

A token-driven system in `src/styles/`: one spacing scale, one radius scale, one
type scale, one elevation scale, and semantic colour tokens redefined for a dark
theme. Buttons, cards, inputs, chips, badges and skeletons are defined once as
global primitives so no feature invents its own. The theme follows the OS by
default and can be toggled; the choice is remembered.

Responsive layouts were checked at 1440 / 1024 / 768 / 390 px, with an automated
assertion that no page overflows horizontally at any of them. Layouts are
restructured per breakpoint rather than scaled down — the checkout summary moves
above the form on narrow screens, cart line controls drop to their own row, and
the header sheds its tagline and nav labels before anything can overflow.

---

## Scaling considerations

**10,000+ products.** The current client-side filter/sort/page becomes wrong on
payload size, not DOM size. The seam is already in place: the presentation layer
consumes a `ProductPage` and emits page requests, so moving the query to the
server changes `ProductApiService`, the effect and one selector — no component
changes. See **[ADR-002](docs/adr-002-pagination.md)**. Two things would visibly
change: sorting must move server-side (sorting one page client-side produces a
list that is sorted within the page and wrong overall), and the exact category
counts on the filter chips need a facets endpoint or must be dropped.

**Real inventory.** A `stock` field on the product response drives an advisory
badge and a disabled add-to-cart; the authoritative check happens server-side
inside the transaction that decrements it, returning per-line conflicts the
checkout renders. Deliberately not faked here —
[why](docs/testing-notes.md#deliberately-not-implemented-authoritative-stock-and-inventory).

**Real payments.** The client never touches card data. A provider's hosted
fields or a redirect flow; the client sends `(productId, quantity)` pairs and
the **server** computes the total from server-held prices. Today's
`orderSubmitted` action carries a client-side total, which is fine for a demo
and unacceptable with real money.

**Authentication.** A token in an `HttpOnly; Secure; SameSite` cookie, not
`localStorage`. An auth interceptor, route guards, and a `user` slice. The cart
slice would gain an "owner" so switching accounts cannot inherit a basket.

**Backend cart sync.** The cart becomes server-owned with the local copy as an
optimistic cache: dispatch optimistically, reconcile from the response, and
resolve conflicts server-side with last-write-wins per line. `localStorage`
persistence then serves only signed-out shoppers, and the two baskets merge on
sign-in. The reducer already treats every change as a discrete, replayable
action, which is what makes that migration tractable.

---

## Documentation

| Document                                                             | Contents                                           |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| [docs/adr-001-state-management.md](docs/adr-001-state-management.md) | Why NgRx, and the honest case against it           |
| [docs/adr-002-pagination.md](docs/adr-002-pagination.md)             | Paging today, server pagination tomorrow           |
| [docs/performance-notes.md](docs/performance-notes.md)               | The defect found, fixed and measured               |
| [docs/security-notes.md](docs/security-notes.md)                     | Threat model and dependency audit                  |
| [docs/testing-notes.md](docs/testing-notes.md)                       | Strategy, coverage, deliberate scope decision      |
| [developer-log.md](developer-log.md)                                 | How AI was used, and where its output was rejected |
| [review/CODE_REVIEW.md](review/CODE_REVIEW.md)                       | React code-review exercise                         |

`review/` is a standalone exercise for the assessment — it is not part of the
Angular build, lint or test targets.
