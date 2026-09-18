# ADR-002: Paging the catalogue, and preparing for a large one

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The Fake Store API returns the entire catalogue — 20 products — from a single
`GET /products`. It supports a `?limit=` parameter, but no offset, cursor,
search, category filter or sort. There is therefore no way to ask the server for
"page 3 of jewellery, cheapest first".

The application nevertheless has to be written as though the catalogue were
large, because that is the situation it would face in production.

## Options considered

### Option 1 — Render everything

Fetch all products, render all products.

Fine at 20. At 10,000 it means 10,000 cards, 10,000 images and a very long
first paint. It also makes the component code structurally unable to page later,
because nothing in it expresses the idea of a page.

### Option 2 — Virtual scrolling

Keep everything in memory, render only the visible window.

This fixes DOM size but not the download: the client still transfers and parses
the whole catalogue, and still filters and sorts 10,000 records on the main
thread. It also complicates the grid (measured item heights, scroll containers)
and interacts badly with a responsive multi-column layout.

The brief warns against reaching for virtualisation to be able to say it was
used, and that is exactly what it would be here — the bottleneck at scale is the
payload and the query, not the node count.

### Option 3 — Incremental paging over a query-shaped seam (chosen)

Page the catalogue in the presentation layer today, but express it with the same
inputs and outputs a paginated endpoint would use, so the move to the server is
a change of _implementation_ and not of _interface_.

## Decision

Paging is modelled as a query and a page:

```ts
interface ProductQuery {
  search: string;
  category: string | null;
  sort: ProductSort;
  pageSize: number; // -> ?limit=
  pagesLoaded: number; // -> ?offset= / ?page=
}

interface ProductPage {
  items: readonly Product[];
  shown: number;
  total: number;
  hasMore: boolean;
  remaining: number;
}
```

`ProductQuery` lives in the `products` slice. `selectProductPage` turns
`(catalogue, query)` into a `ProductPage`. The page size is 12, and "Load more"
reveals another page while "Show all" reveals the rest — the shopper is never
forced to paginate to find something, but the default render is bounded.

Any change to the result set (search, category, sort) resets `pagesLoaded` to 1,
because page 3 of a different result set is meaningless.

### Why this is the seam

The product list component consumes `ProductPage` and emits
`nextPageRequested` / `allPagesRequested`. It does not know where the page came
from. Moving to server-side pagination means:

1. `ProductApiService.getProducts(query)` builds a query string and returns
   `ProductPage` — the shape it already returns today.
2. The effect reacts to query changes instead of a single `catalogueRequested`,
   with `switchMap` so a superseded query is cancelled.
3. `selectProductPage` becomes a plain read of `state.page` instead of a
   computation.

**No component template and no component class changes.** Nothing in
`product-list.html`, `product-card`, or `product-filters` refers to the
catalogue array.

The pieces that would need adding — and are absent on purpose, because adding
them now would be speculative code with no way to test it — are a debounced
query→request effect, a per-page loading state (so "Load more" can show a
spinner rather than resolving instantly), and a cache keyed by query.

## Consequences

- At today's scale the whole catalogue is in memory, and filtering and sorting
  run client-side in a memoised selector. That is correct and cheap for 20
  products and would be wrong for 10,000.
- The category filter chips show exact counts, which is only possible because
  the whole catalogue is local. A server-paginated catalogue would need a facets
  endpoint, or the counts would have to be dropped. This is the one piece of UI
  that would visibly change, and it is called out in the README's scaling
  section.
- `pagesLoaded: Number.MAX_SAFE_INTEGER` implements "Show all" without a special
  case in the selector. It reads oddly; the alternative was a separate boolean
  flag, which would have meant two ways to express the same thing.
- Sorting a server-paginated catalogue must move to the server. Sorting one page
  of results client-side produces a list that is sorted within the page and
  wrong overall — a bug worth naming here so nobody "optimises" it back in.
