# Code review — `ProductSearchPanel`

**Files:** `bad-component.tsx` → `refactored-component.tsx`
**Reviewer:** Senior UI Engineer
**Verdict:** Request changes — one blocking defect (infinite request loop), one
security issue, two correctness issues.

Thanks for this — the component does what the ticket asked and the structure is
readable. Most of what follows is the kind of thing that only shows up under a
slow network or a real catalogue, which is exactly why it is worth catching now.
Comments are ordered by severity, not by line number.

---

## 1. Blocking — the fetch effect depends on the state it sets

```tsx
useEffect(() => {
  setLoading(true);
  fetch(`https://fakestoreapi.com/products?search=${search}`)
    .then((res) => res.json())
    .then((data) => {
      setProducts(data);
      setLoading(false);
    });
}, [search, products]);
//           ^^^^^^^^
```

**The problem.** The effect sets `products`, and `products` is in its dependency
array. `setProducts` produces a new array identity on every response, the
dependency comparison is `Object.is`, so the effect re-runs, which fetches
again, which sets `products` again. This is an unbounded request loop.

**Why it matters.** It is not a slow render — it is a client hammering a
third-party API for as long as the tab is open. It very likely passed review in
the demo because the response is fast and small, so the loop looks like a page
that settled. On a real catalogue it is a self-inflicted denial of service, and
on a metered connection it is the user's data.

There are two further problems in the same effect:

- **No cancellation.** Type "shirt" quickly and four requests are in flight. They
  can resolve in any order, so the list can end up showing results for "shi".
- **No `.catch`.** A rejected fetch leaves `loading` stuck at `true` forever and
  produces an unhandled rejection. There is no error path in the UI at all.

**After.** The catalogue is fetched **once** (`[]` deps) because filtering is a
local concern; an `AbortController` cancels on unmount, and a request id guards
against a stale response overwriting a newer one; failure sets an `error` status
that the UI renders.

```tsx
useEffect(() => {
  const controller = new AbortController();
  const requestId = ++searchId.current;

  setStatus('loading');
  fetch('https://fakestoreapi.com/products', { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then((data) => {
      if (requestId !== searchId.current) return;
      setProducts(Array.isArray(data) ? (data as Product[]) : []);
      setStatus('loaded');
    })
    .catch((error: unknown) => {
      if (controller.signal.aborted || requestId !== searchId.current) return;
      setStatus('error');
      reportError(error);
    });

  return () => controller.abort();
}, []);
```

**Trade-off.** Fetching once means the whole catalogue is held client-side and
filtered locally — correct at this size, wrong at 10,000 products. If search
moves server-side, `deferredSearch` becomes a dependency of this effect and a
debounce goes in front of it; the cancellation and request-id guards above are
what make that version safe. That is noted in the file so the next person does
not reintroduce the loop while adding server search.

---

## 2. Blocking (security) — `dangerouslySetInnerHTML` on API-supplied text

```tsx
<h3 dangerouslySetInnerHTML={{ __html: product.title }} />
```

**The problem.** Product titles come from a third-party API. This renders them as
markup, so the API — or anyone who can influence it, including via a compromised
CDN or a cache-poisoning bug — can inject script into our origin. Our origin is
where the cart lives.

I suspect this crept in to render an `&amp;` or `&#39;` correctly in a title,
which is a real annoyance and the wrong fix: it trades an escaping nuisance for
remote code execution.

**After.**

```tsx
<h3>{product.title}</h3>
```

React escapes this. If entity-decoding really is needed, decode to _text_
server-side or with a parser that returns a string, and keep rendering it as
text.

---

## 3. Cart totals are mirrored into state instead of derived

```tsx
const [cartTotal, setCartTotal] = useState(0);
const [cartCount, setCartCount] = useState(0);

useEffect(() => {
  let total = 0;
  let count = 0;
  cart.forEach((line) => {
    total += line.product.price * line.quantity;
    count += line.quantity;
  });
  setCartTotal(total);
  setCartCount(count);
}, [cart]);
```

**The problem.** `cartTotal` is not independent state — it is a function of
`cart`. Copying it into state creates a second source of truth that is correct
only as long as the effect keeps up. Concretely:

- There is **one render where the two disagree**: `cart` updates, the component
  renders with the _old_ total, then the effect runs and renders again. The user
  can see a stale total flash, and a test that asserts immediately after the
  update will read the wrong number.
- It costs an extra render on every cart change.
- If a second writer ever calls `setCartTotal`, the values silently diverge.

**After.**

```tsx
const { total, count } = useMemo(() => sumCart(cart), [cart]);
```

No effect, no extra render, no window where they disagree. The general rule: if
a value can be computed from props or state during render, it must not be state.

This is the same principle the Angular application in this repo follows — cart
totals exist only as NgRx selectors, so the header, cart page and checkout
cannot disagree.

---

## 4. Money is summed in floating point

```tsx
total = total + line.product.price * line.quantity;
```

`0.1 + 0.2 === 0.30000000000000004`. Accumulated over a basket, the total can
land a cent away from the sum of the visible line totals — the classic "the
lines add up to $275.89 but the total says $275.88" support ticket, which is
unreproducible because it depends on the exact combination of prices.

**After:** sum in integer cents and divide once at the end. `.toFixed(2)` is also
replaced with `toLocaleString(..., { style: 'currency' })`, which is what makes
the component work outside the dollar.

---

## 5. List keys are array indices

```tsx
{visible.map((product, i) => <div key={i} ...>)}
```

`visible` is filtered and sorted, so index → product is not stable. When the sort
changes, React reconciles by position: it keeps the DOM node at index 0 and
swaps its contents. Any per-node state (focus, an in-flight CSS transition, a
scroll position, an uncontrolled input if one is added later) follows the _slot_
rather than the product.

**After:** `key={product.id}`. Stable identity, and React can move nodes instead
of rewriting them.

---

## 6. Filtering and sorting run on every render, and `sort` mutates

```tsx
const visible = products.filter(...).sort(...);
```

Two issues. The work is redone on every render, including renders caused by
something unrelated such as a cart update from the parent — and because this
component receives `cart` as a prop, that happens on every single add-to-cart.

More subtly, `Array.prototype.sort` **mutates in place**. It happens to be safe
here only because `.filter()` already returned a copy; delete the filter, or
short-circuit it when the search is empty (which the refactor does), and you are
sorting the `products` state array in place. That is a mutation of state outside
a setter, and it will produce a render that React does not know it needs.

**After:** `useMemo` keyed on `[products, deferredSearch, sort]`, and an explicit
`[...filtered]` copy before sorting.

`useDeferredValue` is also added for the search term, so typing stays responsive
while the list re-renders at a lower priority.

---

## 7. Accessibility

Smaller, but all cheap to fix:

- The search input and the sort select have **no labels** — a screen-reader user
  hears "edit text, blank". `placeholder` is not a label; it also disappears as
  soon as the field has content.
- **"Loading..." is not announced.** It needs `role="status"`, and the failure
  path needs `role="alert"`.
- **There is no empty state.** A search matching nothing renders a blank area
  with no explanation.
- The product list is a list; `<ul>`/`<li>` gives assistive technology the item
  count for free.
- Every "Add to cart" button has the same accessible name. A user tabbing
  through hears "Add to cart" twenty times with no way to tell which is which; a
  visually-hidden product name fixes it.

---

## What was deliberately left alone

- **The `fetch`-in-component pattern.** In a codebase with a data layer I would
  move this to a query hook or a store. That is a bigger change than this PR
  should carry, and the effect above is correct as written. Worth a follow-up
  ticket, not a blocker.
- **The two-option sort.** It mirrors the current design; no need to generalise
  it until a third option exists.
- **No tests were added here.** Items 1, 3, 4 and 5 are each straightforwardly
  testable (assert one fetch call; assert the total on the same render as the
  cart change; assert `sumCart` on `[0.1, 0.2]`; assert node identity across a
  sort change) and I would expect them with the fix.

---

## Summary

| #   | Issue                                     | Severity     | Why it matters                                         |
| --- | ----------------------------------------- | ------------ | ------------------------------------------------------ |
| 1   | Effect depends on the state it sets       | **Blocking** | Unbounded request loop; no cancellation; no error path |
| 2   | `dangerouslySetInnerHTML` on API text     | **Blocking** | XSS on the origin that holds the cart                  |
| 3   | Totals mirrored into state                | High         | Stale render, extra render, two sources of truth       |
| 4   | Float money arithmetic                    | Medium       | Totals disagree with line items by a cent              |
| 5   | Index keys                                | Medium       | Wrong node reuse when the sort changes                 |
| 6   | Unmemoised filter/sort; in-place sort     | Medium       | Work on every parent render; latent state mutation     |
| 7   | Missing labels, live regions, empty state | Medium       | Unusable with a screen reader                          |
