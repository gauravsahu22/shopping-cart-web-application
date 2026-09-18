# ADR-001: NgRx for shared application state

- **Status:** Accepted
- **Date:** 2026-09-18
- **Context:** Kibo Goods storefront (catalogue, cart, checkout)

## Context

The application has three kinds of state, and they are not equivalent:

1. **Shared, cross-feature, and consequential.** The cart is read by the header
   (count badge), the product grid (stepper vs. "Add to cart"), the product
   detail page, the cart page and checkout. It is written from three of those
   places, must survive a reload, and is the input to the one irreversible
   action in the app (placing an order).
2. **Shared and server-derived.** The catalogue plus its load status, error and
   active query (search, category, sort, paging).
3. **Purely local view state.** Whether a field has been touched, the theme, a
   toast that disappears in four seconds, whether an image has loaded.

The decision below concerns categories 1 and 2. Category 3 deliberately does
**not** use the store (see "Consequences").

## Options considered

### Option 1 — Component and local state only

Keep the cart in the component that owns it and pass it around.

**Pros**

- No library, no boilerplate, nothing to learn.
- Fastest possible path to a working screen.

**Cons**

- There is no component that sensibly owns the cart. The header and the grid are
  siblings in different lazy-loaded chunks; the only common ancestor is the root
  shell, so the cart would live there and be threaded down through inputs and
  outputs to every consumer.
- Add-to-cart is triggered from three different routes. Each would need its own
  path back up to the owner, and the merge rule ("same product increments rather
  than duplicating") would be re-implemented or re-passed each time.
- Persistence would end up in a component lifecycle hook, which is exactly where
  it drifts out of sync with the state it is meant to mirror.

Rejected: the shape of the cart's readers and writers makes it a poor fit for
component ownership, regardless of application size.

### Option 2 — RxJS service with a `BehaviorSubject`

A `CartService` holding a `BehaviorSubject<CartItem[]>`, exposing derived
observables.

**Pros**

- Angular-native, no dependency, genuinely lightweight.
- Perfectly adequate for this application's current size. This is the option
  that would win if the brief were only "a cart that works".
- Easy to unit test.

**Cons**

- **State transitions are not enforced.** Anything holding the service can call
  `next()` with an arbitrary array. The "one line per product" and "quantity
  between 1 and 99" invariants live in whichever methods happen to be used,
  rather than in one place that all changes must pass through.
- **Read-modify-write is easy to get wrong.** The natural implementation is
  `this.items$.next([...this.items$.value, item])`. Under a burst of clicks that
  pattern is correct only as long as every writer remembers to read the current
  value inside the callback; a captured value anywhere produces a lost update.
  A reducer makes `(previousState, action) => nextState` the only option.
- **Derived values multiply.** Subtotal, total quantity, line count and the
  per-product quantity lookup each need building and memoising by hand with
  `map` + `shareReplay`, and `shareReplay` is easy to misconfigure into a leak.
- **Persistence has no natural home.** It ends up either in every mutating
  method or in a `subscribe` in the service constructor.
- Conventions become team-dependent: the next developer's `WishlistService` will
  look different from `CartService` unless someone polices it.

### Option 3 — NgRx Store (chosen)

**Pros**

- **One definition of every transition.** The reducer is the only thing that can
  change the cart, and it is a pure function, so rapid clicks reduce in sequence
  with no possibility of a stale snapshot. The reducer tests exercise exactly
  this (20 increments in a row, decrement at the floor, add-existing-product).
- **Derived state is memoised and centralised.** Subtotal, total, quantity map
  and the paged catalogue view are selectors. No template and no service
  recomputes a total, so the header, cart page and checkout cannot disagree —
  which is the bug this pattern actually prevents.
- **Persistence sits at the right boundary.** A meta-reducer wraps the cart
  reducer, so every state change is persisted by construction rather than by
  each writer remembering to. Validation on the way back in lives in the same
  module.
- **Effects give explicit concurrency.** `exhaustMap` for the catalogue (ignore
  retry spam while a request is in flight) and `switchMap` for product detail
  (render the last product requested, not the last response received) are stated
  in one line each and are visible to a reviewer.
- **Tooling.** Every action is inspectable, and time-travel debugging made the
  cart-persistence bug (documented in `developer-log.md`) obvious.
- **It scales along the axis this codebase would actually grow.** Adding
  wishlist, auth or server cart sync means adding a slice with the same shape,
  not inventing a new convention.

**Cons**

- **Boilerplate.** Five files for the cart slice where a service would be one.
- **Learning curve** for anyone who has not used the actions/reducers/selectors
  /effects split, and more moving parts to hold in mind when tracing a change.
- **Genuine overkill for a small application.** For a cart of this size, Option 2
  would ship sooner and read more directly. This is a real cost, not a
  formality.
- Indirection: "where does this number come from?" is two hops (selector →
  reducer → action) rather than one.

## Decision

Use NgRx for the cart, catalogue and checkout slices.

The deciding factor is **not** that NgRx is better in the abstract — for an
application this size, the RxJS service is the more proportionate choice. It is
that the cart's characteristics are the ones NgRx exists for: multiple
independent writers, many independent readers, a hard correctness requirement
under rapid repeated input, derived totals that must agree everywhere they are
shown, persistence of untrusted data, and a state machine that feeds a
non-reversible action. Getting that wrong produces the class of bug a customer
notices and a developer cannot reproduce.

The brief also asks for an architecture suited to a growing production
application and a senior team, where the cost of NgRx (boilerplate) is paid once
and the benefit (enforced, uniform, inspectable transitions) is paid back per
feature and per developer.

## Consequences

- Three slices exist: `products`, `cart`, `checkout`. All are registered at
  bootstrap because the header reads the cart on every route and the checkout
  slice must outlive the cart being cleared. The **components** are lazy, which
  is where the bundle saving actually is.
- **Not everything goes in the store**, and this is deliberate. Theme, toasts,
  image load/error state and form-touched state are signals in components or
  small services. Putting them in the store would add ceremony to state that no
  other feature reads and that has no business meaning — the failure mode of
  adopting NgRx uncritically.
- Cart totals may only be read from selectors. A pull request that computes a
  subtotal in a template or a service should be rejected.
- The `sumLineTotals` / `lineTotal` helpers in `core/utils/money.ts` are the one
  place money arithmetic happens, in integer cents, so a line total and the cart
  total cannot round differently.
- If this application were reduced to a single page with a single writer, the
  right move would be to revisit this decision rather than defend it.
