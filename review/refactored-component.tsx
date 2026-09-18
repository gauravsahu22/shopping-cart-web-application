import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

/**
 * ProductSearchPanel — after review.
 *
 * Changes, in the order they are discussed in CODE_REVIEW.md:
 *  1. The fetch effect no longer depends on the state it sets.
 *  2. Requests are cancelled on unmount/supersede and failures are handled.
 *  3. Cart totals are derived, not mirrored into state.
 *  4. Product titles are rendered as text.
 *  5. List keys are product ids.
 *  6. Money is summed in integer cents.
 *  7. Filtering and sorting are memoised, and sorting no longer mutates.
 *  8. The control has a label and the busy/error states are announced.
 */

type Product = {
  id: number;
  title: string;
  price: number;
  category: string;
  rating: { rate: number; count: number };
};

type CartLine = { product: Product; quantity: number };
type SortOption = 'price-asc' | 'price-desc';
type Status = 'idle' | 'loading' | 'loaded' | 'error';

type Props = {
  cart: readonly CartLine[];
  onAddToCart: (product: Product) => void;
};

/** Totals are summed in minor units; floats drift by fractions of a cent. */
function sumCart(cart: readonly CartLine[]): { total: number; count: number } {
  let totalCents = 0;
  let count = 0;
  for (const line of cart) {
    totalCents += Math.round(line.product.price * 100) * line.quantity;
    count += line.quantity;
  }
  return { total: totalCents / 100, count };
}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function ProductSearchPanel({ cart, onAddToCart }: Props) {
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('price-asc');
  const [status, setStatus] = useState<Status>('idle');

  // Keeps typing responsive: the input updates immediately, the expensive list
  // re-renders at a lower priority. See the note at the end of this file.
  const deferredSearch = useDeferredValue(search);
  const searchId = useRef(0);

  useEffect(() => {
    // The catalogue is fetched once. Filtering is a local concern, so it does
    // not belong in the dependency list of a network effect — and `products`
    // certainly does not, since this effect sets it.
    const controller = new AbortController();
    const requestId = ++searchId.current;

    setStatus('loading');
    fetch('https://fakestoreapi.com/products', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        // A stale response must never overwrite a newer one.
        if (requestId !== searchId.current) return;
        setProducts(Array.isArray(data) ? (data as Product[]) : []);
        setStatus('loaded');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (requestId !== searchId.current) return;
        setStatus('error');
        // Detail goes to the error reporter; the user sees a safe message.
        reportError(error);
      });

    return () => controller.abort();
  }, []);

  // Derived, not mirrored: one source of truth, no effect, no stale render.
  const { total, count } = useMemo(() => sumCart(cart), [cart]);

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filtered =
      term.length === 0
        ? products
        : products.filter((product) => product.title.toLowerCase().includes(term));

    // Copy before sorting: `Array.prototype.sort` mutates in place, and
    // `products` is state.
    return [...filtered].sort((a, b) =>
      sort === 'price-asc' ? a.price - b.price : b.price - a.price,
    );
  }, [products, deferredSearch, sort]);

  return (
    <section>
      <label htmlFor="product-search">Search products</label>
      <input
        id="product-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <label htmlFor="product-sort">Sort by</label>
      <select
        id="product-sort"
        value={sort}
        onChange={(event) => setSort(event.target.value as SortOption)}
      >
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>

      <p aria-live="polite">
        {count} {count === 1 ? 'item' : 'items'} — {formatPrice(total)}
      </p>

      {status === 'loading' && <p role="status">Loading products…</p>}

      {status === 'error' && <p role="alert">We couldn’t load the catalogue. Please try again.</p>}

      {status === 'loaded' && visible.length === 0 && <p>No products match “{deferredSearch}”.</p>}

      <ul>
        {visible.map((product) => (
          <li key={product.id} className="card">
            <h3>{product.title}</h3>
            <p>{product.category}</p>
            <p>{formatPrice(product.price)}</p>
            <button type="button" onClick={() => onAddToCart(product)}>
              Add to cart
              <span className="visually-hidden">: {product.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Note on debouncing: with the catalogue fetched once and filtered locally,
 * `useDeferredValue` is the right tool — it keeps the input responsive without
 * adding latency to an operation that never leaves the browser. If this panel
 * ever moves to a search *endpoint*, the fetch effect takes `deferredSearch` as
 * a dependency and a debounce goes back in front of it.
 */
