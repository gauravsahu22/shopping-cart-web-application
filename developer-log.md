# Developer log — AI-assisted development

A record of how AI was used to build Kibo Goods, and — more usefully — where its
output was wrong and what replaced it.

Everything below happened during this build. Where a bug is described, it was a
real bug in this repository, found by the means stated and fixed by the commit
described. Nothing here is illustrative.

---

## AI strategy

### How AI was used

As a fast implementer under close review, not as an architect. The split that
worked:

- **Architecture and trade-offs** — decided first, by hand, then handed to AI as
  constraints. The feature layout, the "pages read the store, components take
  inputs" rule, and the decision to model paging as a query-shaped seam were all
  stated up front. AI that is asked to design _and_ implement tends to produce
  something that works and cannot be defended in review.
- **Implementation** — the bulk. Reducers, selectors, components, SCSS, specs.
  This is where the leverage is: the shape was already decided, so output could
  be judged against a known target.
- **Tests** — generated in bulk, then filtered and reworked (see _Verification_).
- **Documentation** — drafted by AI from the actual diff and the actual command
  output, never from memory.

### How context was supplied

Three things mattered more than prompt wording:

1. **The reference screenshots**, early. Colour, spacing, radius and type scale
   were extracted into `_tokens.scss` _before_ any component was written, so
   every later prompt could say "use the tokens" instead of describing a colour.
2. **Existing code as the spec.** Once `cart.reducer.ts` existed, prompts for the
   products reducer referenced it: "same structure as the cart reducer,
   including the no-op referential-stability rule". Consistency across features
   came from this, not from asking for consistency.
3. **Real output, not descriptions of it.** Failing test output, the CLI's bundle
   table, `grep` results and browser screenshots were fed back verbatim. AI
   reasoning about a described symptom is markedly worse than AI reasoning about
   the actual stack trace.

### How prompts differed by task

| Task           | What the prompt carried                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Architecture   | Constraints and rejected alternatives, asking for the trade-off argument rather than code                |
| Implementation | The target file, its neighbours, and the conventions to match                                            |
| Tests          | The behaviour to protect, plus "assert what the user sees, not the implementation"                       |
| Debugging      | Verbatim error output, the relevant file, and an explicit "explain the mechanism before proposing a fix" |

That last rule caught things. Asked for a fix, AI produces a plausible patch;
asked for the mechanism, it produces an explanation that can be checked — and
sometimes the explanation is obviously wrong, which saves applying the patch.

### How output was reviewed

Every generated file was read before being kept. Beyond that, four mechanical
gates, all of which caught something:

- `npx ng build` — caught a `provideState` overload that does not exist.
- `npm run lint` — caught `ReadonlyArray<T>`, a stray `console.error`.
- `npm run test:ci` — caught the reducer returning a new object on no-ops.
- **Running the actual application in a browser** — caught the persistence bug
  and the `Men'S Clothing` bug, neither of which any of the above would find.

The last one is the one that matters. A suite of generated tests can pass
comfortably while the application is broken in a way a user would notice in five
seconds.

---

## An iterative prompt

**Initial prompt**

> Add cart persistence so the cart survives a page reload. Use localStorage.

**Response**

A `CartService` that subscribed to `store.select(selectCartItems)` and wrote to
`localStorage` in the subscription, plus a `restoreCart` action dispatched from
the `App` component's constructor.

**Problem with the response**

It works, and it is the wrong shape:

- Persistence became a component lifecycle concern. `App` had to know the cart
  needed restoring, which is an implementation detail of a feature it should
  know nothing about.
- The write lived in a long-lived subscription, so persistence could silently
  diverge from state if the subscription was ever missed, disposed, or added
  twice.
- Nothing validated what came back. `JSON.parse` fed straight into the action,
  meaning a hand-edited `localStorage` entry becomes application state — and a
  `NaN` quantity becomes a `NaN` total on screen.

**Improved prompt**

> Persist the cart with an NgRx meta-reducer, not a service subscription, so
> persistence happens at the state boundary and cannot drift.
>
> Treat everything read back from localStorage as hostile input — a user can
> edit it by hand. Validate each field individually: reject an item outright if
> id/title/price/quantity are not the right primitive types; clamp quantity into
> 1..99 rather than rejecting; reject non-http(s) image URLs but keep the item;
> drop duplicate product ids, because the reducer relies on one line per
> product. Never throw — return an empty cart for unparseable input.
>
> The meta-reducer must take `read`/`write` as parameters rather than importing
> a storage module, so tests can drive it with in-memory functions.
> Version the storage key.

**Result**

`cart.persistence.ts` as shipped: `parseCartState` with per-field validation, a
meta-reducer parameterised on `read`/`write`, and a `kibo.cart.v1` key. The
validation rules named in the prompt became the test table in
`cart.persistence.spec.ts` almost one to one — a useful side effect of
specifying behaviour precisely enough to implement.

It still had a bug. See Audit #1.

---

## Human audit — corrections, rejections and reworks

### 1. Structural — the persistence meta-reducer destroyed the cart it was saving

**AI output** (my prompt's structure, AI's implementation of the hydration
trigger):

```ts
return (reducer) => (state, action) => {
  if (action.type === INIT || action.type === UPDATE) {
    return reducer(parseCartState(read()), action);
  }
  const nextState = reducer(state, action);
  if (state !== nextState) {
    write(serializeCartState(nextState));
  }
  return nextState;
};
```

This is the recipe you will find in most NgRx persistence write-ups, and it
passed every unit test written against it.

**How it was found.** Not by tests — by clicking through the running app in a
headless browser and inspecting `localStorage` after each step:

```
storage after add:     {"items":[{"id":1,...,"quantity":1}]}
header after add:      1
storage after reload:  {"items":[]}          <-- wrong
header after reload:   1                     <-- still right, for one load only
storage on /cart:      {"items":[]}
header on /cart:       0                     <-- cart gone
```

The symptom is nasty: the cart survives _one_ reload and vanishes on the next,
so a casual check confirms it works.

**The mechanism.** NgRx runs a feature reducer for actions dispatched before the
slice exists in the root state — not only `INIT` and `UPDATE`. On one of those
calls `state` is `undefined` and the action is something else (`@ngrx/effects/init`
among them), so the guard misses, `reducer(undefined, action)` returns
`initialCartState`, `undefined !== initialCartState` is true, and an **empty
cart is written over the saved one**.

**Why I rejected the fix pattern rather than patching it.** The obvious patch is
to widen the action list. That is guessing at NgRx's internal dispatch order and
will break again when it changes. The real invariant is simpler and does not
depend on action types at all: _`state === undefined` means initialisation —
restore, and never write._

**Human implementation**

```ts
return (reducer) => (state, action) => {
  // `undefined` state means NgRx is initialising this slice — which it does for
  // more than just INIT/UPDATE, because the feature reducer runs for every
  // action dispatched before the slice exists in the root state. Restoring here
  // (and, crucially, *not* writing) is what stops initialisation from
  // overwriting a saved cart with an empty one.
  if (state === undefined) {
    return reducer(parseCartState(read()), action);
  }
  const nextState = reducer(state, action);
  if (nextState !== state) {
    write(serializeCartState(nextState));
  }
  return nextState;
};
```

Shorter, action-agnostic, and correct. A regression test now pins it:
_"does not write while initialising"_, dispatching `@ngrx/effects/init` with
`undefined` state and asserting `write` was never called.

**Takeaway:** the AI output matched the community-standard pattern. Being
standard is not the same as being correct, and only running the real application
exposed the difference.

### 2. Structural — a test assertion revealed a redundant storage write

**AI output.** Every reducer handler built a fresh state object:

```ts
on(CartActions.decrementItem, (state, { id }) => ({
  items: changeQuantity(state.items, id, (q) => Math.max(q - 1, MIN_CART_QUANTITY)),
})),
```

**How it was found.** I wrote an assertion about the property `OnPush` actually
depends on:

```ts
it('returns the identical state object when an action changes nothing', () => {
  const before = stateWith(makeCartItem({ quantity: 1 }));
  const after = cartReducer(before, CartActions.decrementItem({ id: 1 }));
  expect(after).toBe(before); // failed
});
```

It failed. `changeQuantity` correctly returned the _same items array_ when
nothing changed, but the handler still wrapped it in a new object.

**Why it mattered more than it looked.** I had already written the persistence
meta-reducer to write when `nextState !== state`. So every no-op — every press
of "−" on a line already at 1, every increment of a product not in the cart —
serialised the whole cart and wrote it to `localStorage`. A synchronous,
main-thread write for an action that changed nothing.

**Human implementation.** A `withItems` helper, applied to every handler:

```ts
function withItems(state: CartState, items: readonly CartItem[]): CartState {
  return items === state.items ? state : { items };
}
```

with `removeItem` and `clearCart` given the equivalent length checks. One fix,
two benefits: `OnPush` components skip correctly, and the redundant writes are
gone.

**Takeaway:** the test was written to document an intent, not to find a bug, and
found one anyway. Assertions about _referential identity_ are worth writing
precisely because they encode the property the framework's optimisation relies
on — a `toEqual` here would have passed and hidden both problems.

### 3. Structural — a "helpful" extra effect that doubled every request

**AI output.** Asked for the product-detail effect, AI produced two: one to load
the product, and one to also load the whole catalogue whenever a product was
requested.

```ts
readonly ensureCatalogue$ = createEffect(() =>
  this.actions$.pipe(
    ofType(ProductsActions.productRequested),
    withLatestFrom(this.store.select(selectAllProducts)),
    filter(([, products]) => products.length === 0),
    map(() => ProductsActions.catalogueRequested()),
  ),
);
```

**Why I rejected it.** The reasoning offered was "a detail page visited directly
still needs the catalogue". It does not. Nothing on the detail page reads the
catalogue — `loadProduct$` already falls back to `getProduct(id)` when the cache
is empty. The effect's only outcome was that every cold visit to `/products/3`
fired **two** requests instead of one, for data nothing rendered.

This is the most common failure mode I saw: plausible code solving a problem
that was never stated, justified by a rationale that does not survive checking
against what the components actually read.

**Human implementation.** Deleted. `loadProduct$` handles both paths in one
effect — cache hit, or single fetch. The detail page is covered by tests for
both branches (_"serves a product from the loaded catalogue without a second
request"_ asserts `getProduct` was never called).

### 4. Correction — API service accumulating ceremony

AI's `ProductApiService` arrived with a `static readonly isReadOnly = true`
"guard against accidental writes" (it guards nothing — nothing reads it) and an
exported `assertNever` helper that no code path could reach. Both deleted. Dead
code with an explanatory comment is worse than no code: a reader assumes it is
load-bearing.

### 5. Correction — `provideState(feature, { metaReducers })`

AI registered the cart slice as `provideState(cartFeature, { metaReducers: [...] })`.
That overload does not exist; the build failed with a three-screen TS2769.
Rewritten as `provideState(cartFeature.name, cartFeature.reducer, { metaReducers })`,
and because the meta-reducer needs storage functions outside an injection
context, `StorageService` (a dependency-free class) is instantiated directly in
`app.config.ts` with a comment explaining why.

Worth recording as a category: AI is confident about API _shapes_ that look
reasonable and do not exist. The compiler is the cheapest reviewer available,
which is why `strict` and a build gate matter more in AI-assisted work, not less.

### 6. Correction — `Men'S Clothing`

`toLabel` used `category.replace(/\b[a-z]/g, c => c.toUpperCase())`. A word
boundary sits after an apostrophe, so `men's clothing` rendered as
**Men'S Clothing** on every filter chip. Found by looking at a screenshot, not by
a test — the unit test asserted "the label is title-cased", which it was.

Fixed to match word starts only, and the test now asserts the specific thing
that was broken:

```ts
expect(labels).toContain("Men's Clothing");
expect(labels).not.toContain("Men'S Clothing");
```

### 7. Rework — `::ng-deep` to remove one border

To drop the border on the last cart line, AI reached for
`.cart__list li:last-child ::ng-deep .line { border-bottom: 0; }`. `::ng-deep` is
deprecated and leaks styles out of the component that declares them. Reworked by
moving the border onto the `app-cart-line` host element, which the parent can
target legitimately because the host lives in the parent's template.

---

## AI verification — how generated tests were checked

Generated tests are the easiest thing to accept uncritically and the most
dangerous, because a green suite is exactly what a broken test looks like.

**Edge cases AI suggested that were accepted** (these were genuinely good, and
several I would not have listed unprompted):

- Adding the same product twice must increment, not duplicate.
- Decrement at quantity 1 must not reach 0.
- Removing the last item must leave a valid empty cart.
- Malformed JSON in `localStorage`.
- An API response that is an object rather than an array.
- A product with a missing `rating` object.
- Sorting must not mutate the source array.
- Storage throwing on access (private browsing).

**Patterns deliberately kept out**, because each one passes whether or not the
feature works:

- _Asserting `store.dispatch` was called._ An implementation detail — it passes
  with a reducer that ignores the action entirely. The replacement asserts the
  outcome: add to cart, then check the card reads "In cart" **and** the header
  count reads 1.
- _Snapshotting rendered markup._ Fails on every copy change and passes on every
  logic change — exactly backwards.
- _Asserting a mock returned what the mock was told to return._
- _Testing Angular itself_ — input binding, router navigation. That is the
  framework's test suite, not ours.

Two generated specs were reworked rather than kept: a "shows a skeleton while
loading" test that had been written so the mock resolved immediately (it
asserted nothing about loading, and was rewritten to hold the request open with
`NEVER` and assert the skeleton renders), and a persistence test that asserted a
throwing storage reader _throws_ — which tested the test's own fake rather than
`StorageService`'s actual guard. The latter was deleted and replaced with a real
`StorageService` spec that mocks `Storage.prototype.getItem` to throw.

**How tests were checked against real behaviour:**

1. **Deliberate breakage (mutation testing by hand).** Four defects were
   introduced into working code, one at a time, and the suite re-run. Actual
   results:

   | Mutation                                                            | Tests that failed |
   | ------------------------------------------------------------------- | ----------------- |
   | Remove the quantity clamp in `clampQuantity`                        | 1                 |
   | Invert the `price-asc` comparator                                   | 2                 |
   | `parseCartState` always returns an empty cart                       | 8                 |
   | `upsert` appends a new line instead of incrementing an existing one | 1                 |

   All four were caught, and every file was restored afterwards (the suite is
   back to 175 passing). The exercise is also a coverage check with teeth: it
   shows that the tests fail for the _right_ reasons, which a percentage cannot.
   It is worth noting the two mutations caught by a single test each — those are
   the assertions that are actually load-bearing, and the ones to be careful
   about deleting.

2. **Real store, fake HTTP.** `product-list.spec.ts` and `cart-page.spec.ts` wire
   up the genuine store, reducers, selectors and effects, replacing only
   `ProductApiService`. Mocking the store would mean the suite passes with a
   broken reducer.
3. **Assert rendered output.** The cart total is checked as the string `$275.89`
   read out of the DOM, not as a selector's return value — that covers the
   selector, the binding, the pipe and the template together.
4. **Cross-check against the browser.** Every flow with a unit test was also
   walked manually in a real browser with the console open, and the E2E suite
   asserts the same outcomes against the live API.

The two bugs in Audits #1 and #2 are the argument for step 4: #2 was caught by a
test written for a different reason, and #1 was invisible to the entire suite.

---

## AI disagreement — the stock badge (and two others)

**AI recommendation.** The reference design shows an amber `ONLY 3 LEFT` badge on
product cards. Asked to implement the card to match, AI proposed:

```ts
// Simulated stock — Fake Store API doesn't provide inventory
const stock = (product.id * 7) % 12;
const isLowStock = stock > 0 && stock <= 5;
```

and, when pushed, offered `Math.floor(Math.random() * 10)` held in component
state as the alternative. It reasoned that the badge is a visual requirement of
the design, that the derivation is deterministic per product, and that the
comment makes the simulation explicit.

**My analysis.** The design is a reference for _visual language_ — palette,
spacing, card rhythm — not a specification that every pixel must exist
regardless of whether the data does. The badge asserts a fact to the customer:
_there are three of these left_. We have no idea how many there are.

Concretely, shipping it means:

- The number is wrong. Not approximate — unrelated to reality.
- `id * 7 % 12` is stable per product but arbitrary; product 5 is permanently
  "low stock" and product 6 never is, for no reason.
- The `random()` variant is worse: the count changes on every reload, so a
  product is scarce, then plentiful, then gone.
- It creates false urgency, which in a real store is the kind of dark pattern
  that attracts regulatory attention.
- Worst: it is a foothold. The next developer sees a stock value in the model and
  validates the cart against it. Now a fiction is load-bearing.

The "it's just a demo" defence is the one I trust least. Demo code is exactly
what gets copied into the real thing.

**Why I disagreed with the AI's reasoning specifically.** Its justification was
that a code comment makes the simulation honest. A comment is honest to the
_developer_. The customer sees "ONLY 3 LEFT" and believes it. Honesty at the
wrong layer is not honesty.

**Final implementation.** No stock anywhere in the model, the state or the UI.
The badge slot in the card is kept — the design's rhythm was worth preserving —
and filled with **"Top rated"**, shown when `rating.rate >= 4.5`. That is
computed from a value the API genuinely returns, it is true, and it is useful.

The gap is documented rather than papered over, in
[docs/testing-notes.md](docs/testing-notes.md#deliberately-not-implemented-authoritative-stock-and-inventory),
together with how a real system would do it: stock as an advisory field on the
product response, with the authoritative check server-side inside the
transaction that decrements inventory.

**A second, smaller disagreement.** AI recommended `logOnly: !isDevMode()` for
the store devtools, describing it as the standard production-safe
configuration. It is standard, and it is about _behaviour_, not _bundle_: the
import is unconditional, so the entire devtools package shipped to production. I
verified that switching to `isDevMode() ? provideStoreDevtools(...) : []` did not
help either (the `main` chunk stayed at 30.60 kB), and replaced both with a
build-time `fileReplacements` swap. Measured result: `main` 30.61 kB → 19.27 kB.
Details in [docs/performance-notes.md](docs/performance-notes.md).

**A third disagreement — the visual design and the flow.** This one came first
chronologically and was the largest rework, so it is worth recording in full.

Asked for "a product listing with search, filters and sort", the first pass came
back styled the way AI defaults to when nobody says otherwise: white page,
system-blue primary buttons, uniform grey borders, equal type sizes, a filter
`<select>` for category, and every screen laid out as one flat column of cards.
It was not broken. It was anonymous — it could have been any of ten thousand
admin dashboards, and it looked nothing like the storefront in the brief.

**What I rejected and why.** The disagreement was not "I prefer a different
colour". It was that the AI had treated visual design as decoration applied per
component after the fact, so:

- Colours were hard-coded per component (`#2563eb` in four different files), which
  means a theme change is a find-and-replace and a dark mode is impossible.
- There was no type scale — headings were `font-size: 24px`, `20px`, `18px`
  chosen locally, so nothing lined up across pages.
- Every screen invented its own spacing, so the rhythm changed as you navigated.
- Category selection was a `<select>`, which hides the options and gives no sense
  of what the catalogue contains.

**How I redirected it.** I stopped asking for components and specified the system
first, explicitly:

> Do not style components yet. First build `src/styles/_tokens.scss` as the only
> place a colour, radius, spacing step or font size is ever defined. Palette:
> crimson `#d0263a` as the accent, deep plum `#2e1b33` as the dark ground, muted
> gold `#e6d0a0` for highlights. Two themes — a cream light theme on `:root` and
> the plum dark theme under `[data-theme='dark']` — where the dark theme
> redefines _only the token values_, never a rule. A serif display face for
> headings and brand, a system stack for body. Spacing on a 1–9 scale, radius
> sm/md/lg/xl/pill. Then build every component against those tokens, and if a
> component needs a raw hex value, stop and tell me which token is missing
> instead of inlining it.

Then, separately, the flow — because "add to cart" hides several decisions the
AI had made silently and wrongly:

> The card shows "Add to cart" only until the product is in the cart; after that
> the same slot becomes a quantity stepper, so the card always reflects cart
> state and there is no second "you added this" mode to reason about. Decrement
> at quantity 1 must not silently delete the line — it becomes an explicit
> Remove. Category filtering is chips with live counts, not a `<select>`, so the
> shape of the catalogue is visible. Checkout is a single page: form on the left,
> a persistent order summary on the right that matches the cart totals exactly
> because both read the same selector. On submit, a client-generated reference
> and a confirmation screen that cannot be reached by URL without an order.

**Why the second attempt worked.** The first prompt asked for an _outcome_
("make it look like the screenshots") and got an imitation of the surface. The
second asked for the _constraint that produces the outcome_ — one token file,
no raw values, themes as data — and the surface followed from it. That is the
same lesson as the prompt in the section above: AI is reliable at applying a
system and unreliable at inventing one.

**What it cost and what it bought.** The rework was roughly a day, and it was
not optional: the light/dark toggle, the consistent spacing at 390px, and the
fact that `.btn` / `.card` / `.panel` are defined once in `_ui.scss` and shared
by cart and checkout all fall out of the token layer. None of them were
retrofittable onto the first version without rewriting every stylesheet anyway.

**What I kept from the AI's version.** Its grid breakpoints were sensible and
survived unchanged, and its instinct to give the product image a fixed
`aspect-ratio` box — which I had not asked for — was right, and is why the grid
does not shift as images load.

---

## What AI was genuinely good at

Worth recording honestly, since the sections above are all corrections:

- **Volume with consistency.** Eighteen spec files following one convention,
  written far faster than by hand, and consistent _because_ the convention was
  supplied up front.
- **Edge cases in pure functions.** The validation and money tests are more
  thorough than I would have written unprompted — `0.1 + 0.2`, clamping
  behaviour, duplicate ids, non-array payloads.
- **SCSS from a token system.** Given `_tokens.scss` and a screenshot, the
  component styles needed very little correction.
- **Boilerplate that is tedious and error-prone by hand** — action groups,
  `createFeature` wiring, `TestBed` setup.

**Where it consistently needed a human:** anything where "looks right" and "is
right" diverge. The persistence bug, the doubled request, the fake stock, the
devtools bundle — every one of them produced code that ran, passed tests, and
was wrong. The review effort is not in reading the code; it is in running the
application and checking the claims.
