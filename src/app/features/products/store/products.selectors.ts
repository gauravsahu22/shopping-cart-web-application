import { createSelector } from '@ngrx/store';
import {
  Product,
  ProductPage,
  ProductQuery,
  ProductSort,
} from '../../../core/models/product.model';
import { productsFeature } from './products.reducer';

export const {
  selectItems: selectAllProducts,
  selectStatus: selectProductsStatus,
  selectError: selectProductsError,
  selectQuery: selectProductQuery,
  selectDetail: selectProductDetail,
} = productsFeature;

export const selectProductsLoading = createSelector(
  selectProductsStatus,
  (status) => status === 'loading' || status === 'idle',
);

export interface CategoryOption {
  readonly value: string | null;
  readonly label: string;
  readonly count: number;
}

/**
 * Title-cases the API's lowercase category slugs for display. Word boundaries
 * only — a naive `\b[a-z]` also capitalises after an apostrophe ("Men'S").
 */
function toLabel(category: string): string {
  return category.replace(
    /(^|\s)([a-z])/g,
    (_match, prefix: string, letter: string) => prefix + letter.toUpperCase(),
  );
}

export const selectCategoryOptions = createSelector(
  selectAllProducts,
  (products): readonly CategoryOption[] => {
    const counts = new Map<string, number>();
    for (const product of products) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    }
    const categories = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: toLabel(value), count }));
    return [{ value: null, label: 'All', count: products.length }, ...categories];
  },
);

const comparators: Record<ProductSort, (a: Product, b: Product) => number> = {
  featured: () => 0,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  'rating-desc': (a, b) => b.rating.rate - a.rating.rate,
  'name-asc': (a, b) => a.title.localeCompare(b.title),
  'name-desc': (a, b) => b.title.localeCompare(a.title),
};

function matchesQuery(product: Product, search: string, category: string | null): boolean {
  if (category !== null && product.category !== category) {
    return false;
  }
  if (search.length === 0) {
    return true;
  }
  return product.title.toLowerCase().includes(search);
}

/**
 * Filtering and sorting happen once per (catalogue, query) pair and are then
 * memoised. Doing this in a selector rather than in the template is what keeps
 * an unrelated cart update from re-sorting the catalogue.
 */
export const selectFilteredProducts = createSelector(
  selectAllProducts,
  selectProductQuery,
  (products, query: ProductQuery): readonly Product[] => {
    const search = query.search.trim().toLowerCase();
    const filtered = products.filter((product) => matchesQuery(product, search, query.category));
    const comparator = comparators[query.sort];
    // `featured` preserves the API's own ordering, so skip the sort entirely.
    return query.sort === 'featured' ? filtered : [...filtered].sort(comparator);
  },
);

/**
 * The paged slice handed to the grid.
 *
 * This is the seam described in docs/adr-002-pagination.md: today the page is
 * computed from an in-memory catalogue, but the shape is what a paginated
 * endpoint would return, so moving the work server-side does not touch the UI.
 */
export const selectProductPage = createSelector(
  selectFilteredProducts,
  selectProductQuery,
  (products, query): ProductPage => {
    const limit = Math.min(query.pageSize * query.pagesLoaded, products.length);
    const items = limit >= products.length ? products : products.slice(0, limit);
    return {
      items,
      shown: items.length,
      total: products.length,
      hasMore: items.length < products.length,
      remaining: products.length - items.length,
    };
  },
);

export const selectHasActiveFilters = createSelector(
  selectProductQuery,
  (query) => query.search.trim().length > 0 || query.category !== null || query.sort !== 'featured',
);

export const selectIsCatalogueEmpty = createSelector(
  selectFilteredProducts,
  selectProductsStatus,
  (products, status) => status === 'loaded' && products.length === 0,
);
