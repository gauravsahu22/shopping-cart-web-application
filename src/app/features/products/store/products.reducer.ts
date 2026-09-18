import { createFeature, createReducer, on } from '@ngrx/store';
import { AppError } from '../../../core/models/app-error.model';
import { Product, ProductQuery } from '../../../core/models/product.model';
import { ProductsActions } from './products.actions';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** One page of catalogue results. Mirrors what a server-side `limit` would be. */
export const PRODUCT_PAGE_SIZE = 12;

export interface ProductsState {
  readonly items: readonly Product[];
  readonly status: LoadStatus;
  readonly error: AppError | null;
  readonly query: ProductQuery;
  readonly detail: {
    readonly product: Product | null;
    readonly status: LoadStatus;
    readonly error: AppError | null;
  };
}

export const initialQuery: ProductQuery = {
  search: '',
  category: null,
  sort: 'featured',
  pageSize: PRODUCT_PAGE_SIZE,
  pagesLoaded: 1,
};

export const initialProductsState: ProductsState = {
  items: [],
  status: 'idle',
  error: null,
  query: initialQuery,
  detail: { product: null, status: 'idle', error: null },
};

/** Any change to the result set resets paging: page 3 of a new filter is meaningless. */
function withQuery(state: ProductsState, patch: Partial<ProductQuery>): ProductsState {
  return { ...state, query: { ...state.query, ...patch, pagesLoaded: 1 } };
}

export const productsFeature = createFeature({
  name: 'products',
  reducer: createReducer(
    initialProductsState,
    on(ProductsActions.catalogueRequested, (state) => ({
      ...state,
      status: 'loading' as const,
      error: null,
    })),
    on(ProductsActions.catalogueLoaded, (state, { products }) => ({
      ...state,
      items: products,
      status: 'loaded' as const,
      error: null,
    })),
    on(ProductsActions.catalogueFailed, (state, { error }) => ({
      ...state,
      status: 'error' as const,
      error,
    })),

    on(ProductsActions.productRequested, (state) => ({
      ...state,
      detail: { product: null, status: 'loading' as const, error: null },
    })),
    on(ProductsActions.productLoaded, (state, { product }) => ({
      ...state,
      detail: { product, status: 'loaded' as const, error: null },
    })),
    on(ProductsActions.productFailed, (state, { error }) => ({
      ...state,
      detail: { product: null, status: 'error' as const, error },
    })),

    on(ProductsActions.searchChanged, (state, { search }) => withQuery(state, { search })),
    on(ProductsActions.categoryChanged, (state, { category }) => withQuery(state, { category })),
    on(ProductsActions.sortChanged, (state, { sort }) => withQuery(state, { sort })),
    on(ProductsActions.filtersCleared, (state) => ({ ...state, query: initialQuery })),

    on(ProductsActions.nextPageRequested, (state) => ({
      ...state,
      query: { ...state.query, pagesLoaded: state.query.pagesLoaded + 1 },
    })),
    on(ProductsActions.allPagesRequested, (state) => ({
      ...state,
      query: { ...state.query, pagesLoaded: Number.MAX_SAFE_INTEGER },
    })),
  ),
});

export const { name: productsFeatureKey, reducer: productsReducer } = productsFeature;
