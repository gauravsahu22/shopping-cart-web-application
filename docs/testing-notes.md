# Testing notes

## Strategy

The suite is weighted towards the places where a bug would actually cost
something: state transitions, derived money, untrusted input, and the purchase
journey end to end.

| Layer               | Tool                                                 | What it covers                                                                                     |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Pure logic          | Vitest                                               | Reducers, selectors, money arithmetic, API/response parsing, persistence validation, error mapping |
| Side effects        | Vitest + `provideMockActions` / `MockStore`          | Catalogue and product effects, checkout effects, concurrency behaviour                             |
| Components          | Vitest + `TestBed`                                   | Product card, quantity stepper, header                                                             |
| Feature integration | Vitest + **real store, real reducers, real effects** | Product list and cart pages, with only the HTTP boundary faked                                     |
| End to end          | Playwright (desktop + mobile viewports)              | The full journey, persistence, tampering, failure + retry, keyboard navigation                     |

Run:

```bash
npm test              # watch
npm run test:ci       # single run with coverage + thresholds
npm run e2e           # Playwright, desktop-chromium + mobile-chromium
```

## Coverage

Measured on 2026-09-18 via `npm run test:ci` (v8 provider, `src/app/**/*.ts`):

```
Statements   : 86.33% ( 613/710 )
Branches     : 90.1%  ( 346/384 )
Functions    : 85.26% ( 162/190 )
Lines        : 85.32% ( 471/552 )
```

**Thresholds are enforced in `angular.json`** and the build fails below them:
statements 80, lines 80, functions 80, branches 75.

### Why those numbers

80% is set as a floor, not a target. It is high enough to catch a whole file or
a whole branch going untested, and low enough that nobody is pushed into writing
assertions about presentational markup to move a percentage. Branches are set
lower (75%) deliberately: a large share of remaining branches are defensive
guards on paths that cannot occur in practice (`??` fallbacks, optional chaining
on values the type system already narrows), and chasing those produces tests
that assert the test's own mock rather than any behaviour.

The business-critical modules are well above the floor — the cart reducer,
selectors, persistence validation, product parser and money helpers are the
files a bug would hurt most, and they are the most thoroughly covered.

The uncovered remainder is mostly the presentational shell: parts of the
checkout and order-confirmation templates, the toast host, the theme service's
`prefers-color-scheme` branch, and the product-image error fallback. The
journeys through those screens are covered end to end by Playwright instead,
which is a better test of them than a `TestBed` assertion on markup.

`main.ts`, `app.config.ts`, `app.routes.ts` and the test helpers are excluded
from coverage: they are composition, and testing them would be asserting that
Angular wires providers correctly.

## How tests were kept honest

The failure mode with generated tests is a suite that passes whether or not the
feature works. Three rules were applied:

1. **Assert what the user sees.** Integration tests locate elements the way a
   person does — `getByRole`, button text, rendered prices — so a refactor that
   preserves behaviour does not break them, and a regression that preserves
   structure does.
2. **Use the real machinery.** `product-list.spec.ts` and `cart-page.spec.ts`
   run the actual store, reducers, selectors and effects, and replace only
   `ProductApiService`. A test that mocks the store would pass with a broken
   reducer.
3. **Make each test fail on purpose once.** Several assertions were checked by
   temporarily breaking the code they cover. Two of those attempts found real
   bugs rather than confirming the test — see `developer-log.md`, where the
   referential-stability assertion in `cart.reducer.spec.ts` exposed a redundant
   `localStorage` write.

Examples of assertions chosen for this reason:

- The cart total is asserted as the **rendered string** (`$275.89`), not as a
  selector return value, so a formatting or binding break is caught too.
- `expect(after).toBe(before)` on a no-op reducer action asserts _referential
  identity_, which is the property `OnPush` actually depends on.
- The error-state test does not assert the message text alone; it retries the
  request and asserts the grid comes back, which is the behaviour that matters.
- The E2E tampering test writes hostile JSON into `localStorage` and asserts the
  real app still renders — a unit test of the validator cannot prove the app
  survives.

---

## Deliberately not implemented: authoritative stock and inventory

**The gap.** There is no stock level, no "only 3 left" badge, no out-of-stock
state, and no check that the quantity a shopper adds is actually available.

**Why.** The Fake Store API exposes no inventory field whatsoever. Implementing
this would mean inventing stock numbers on the client — deriving them from the
product id, or holding a random number in state. That would look convincing in a
demo and be actively harmful as production behaviour:

- Two shoppers would see different "remaining" counts for the same product,
  because each browser invented its own.
- The number would reset on reload, so a product could be "out of stock" and
  then available again.
- It would appear to be a real constraint, so the next developer might build
  on it — validating a cart against a fiction.

Stock is inherently server-authoritative. It changes because of _other people's_
orders, which a client cannot observe.

The reference design provided with the brief does show a stock badge. Rather
than fake it, the card surfaces a **"Top rated"** badge computed from the
`rating.rate` the API really returns, which keeps the visual rhythm of the
design without asserting something untrue.

**How a real system would handle it.** Stock would be a field on the product
response, so the card could render an accurate badge and disable add-to-cart at
zero. That display is advisory only — the authoritative check happens
server-side at checkout, inside the transaction that decrements inventory, and
returns a per-line conflict (`insufficient_stock`, with the quantity actually
available) that the checkout page renders against the affected line. Optimistic
UI plus a reservation window (hold stock for N minutes once checkout starts) is
the usual refinement. None of that can be demonstrated against this API, and a
client-side imitation of it would be a lie in code.

## Other things left out, and why

- **`MAX_CART_QUANTITY = 99` is a UI guard, not a business rule.** It stops a
  stuck key-repeat producing absurd totals. A real limit would come from the
  server, per product.
- **No visual-regression tests.** The layout was verified by screenshot at
  1440 / 1024 / 768 / 390 px during development, with an automated check that no
  page overflows horizontally at any of those widths. Committing baseline images
  from one headless Chromium build would produce a suite that fails on font
  rendering differences rather than on real regressions.
- **No axe/Lighthouse accessibility audit in CI.** Accessibility is covered
  structurally (semantic markup, `angular-eslint`'s template-accessibility
  rules, which run in `npm run lint`) and behaviourally (a keyboard-only E2E
  journey). An automated audit would be the natural next addition.
