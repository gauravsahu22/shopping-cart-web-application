import { describe, expect, it } from 'vitest';
import { catalogue } from '../../../../testing/fixtures';
import { AppError } from '../../../core/models/app-error.model';
import { ProductsActions } from './products.actions';
import { initialProductsState, initialQuery, productsReducer } from './products.reducer';

const error: AppError = { kind: 'server', message: 'The store is having trouble.', status: 500 };

describe('productsReducer', () => {
  it('moves to loading and clears a previous error when a load starts', () => {
    const failed = productsReducer(
      initialProductsState,
      ProductsActions.catalogueFailed({ error }),
    );
    const state = productsReducer(failed, ProductsActions.catalogueRequested());

    expect(state.status).toBe('loading');
    expect(state.error).toBeNull();
  });

  it('stores a loaded catalogue', () => {
    const state = productsReducer(
      initialProductsState,
      ProductsActions.catalogueLoaded({ products: catalogue }),
    );
    expect(state.status).toBe('loaded');
    expect(state.items).toHaveLength(catalogue.length);
  });

  it('keeps an empty response as a successful but empty catalogue', () => {
    const state = productsReducer(
      initialProductsState,
      ProductsActions.catalogueLoaded({ products: [] }),
    );
    expect(state.status).toBe('loaded');
    expect(state.items).toEqual([]);
  });

  it('records a failure with its user-facing error', () => {
    const state = productsReducer(initialProductsState, ProductsActions.catalogueFailed({ error }));
    expect(state.status).toBe('error');
    expect(state.error).toEqual(error);
  });

  it.each([
    ['search', ProductsActions.searchChanged({ search: 'ring' }), { search: 'ring' }],
    [
      'category',
      ProductsActions.categoryChanged({ category: 'jewelery' }),
      { category: 'jewelery' },
    ],
    ['sort', ProductsActions.sortChanged({ sort: 'price-asc' as const }), { sort: 'price-asc' }],
  ])('applies a %s change', (_label, action, expected) => {
    const state = productsReducer(initialProductsState, action);
    expect(state.query).toMatchObject(expected);
  });

  it('resets paging whenever the result set changes', () => {
    const paged = productsReducer(initialProductsState, ProductsActions.nextPageRequested());
    expect(paged.query.pagesLoaded).toBe(2);

    const filtered = productsReducer(
      paged,
      ProductsActions.categoryChanged({ category: 'jewelery' }),
    );
    expect(filtered.query.pagesLoaded).toBe(1);
  });

  it('reveals every page at once when asked', () => {
    const state = productsReducer(initialProductsState, ProductsActions.allPagesRequested());
    expect(state.query.pagesLoaded).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('restores the default query when filters are cleared', () => {
    let state = productsReducer(
      initialProductsState,
      ProductsActions.searchChanged({ search: 'x' }),
    );
    state = productsReducer(state, ProductsActions.sortChanged({ sort: 'name-desc' }));
    state = productsReducer(state, ProductsActions.filtersCleared());

    expect(state.query).toEqual(initialQuery);
  });

  it('keeps the catalogue when filters change', () => {
    const loaded = productsReducer(
      initialProductsState,
      ProductsActions.catalogueLoaded({ products: catalogue }),
    );
    const filtered = productsReducer(loaded, ProductsActions.searchChanged({ search: 'ring' }));
    expect(filtered.items).toBe(loaded.items);
  });

  it('tracks the product detail lifecycle independently of the catalogue', () => {
    const requested = productsReducer(
      initialProductsState,
      ProductsActions.productRequested({ id: 3 }),
    );
    expect(requested.detail).toEqual({ product: null, status: 'loading', error: null });

    const loaded = productsReducer(
      requested,
      ProductsActions.productLoaded({ product: catalogue[2] }),
    );
    expect(loaded.detail.product?.id).toBe(3);
    expect(loaded.detail.status).toBe('loaded');

    const failed = productsReducer(loaded, ProductsActions.productFailed({ error }));
    expect(failed.detail).toEqual({ product: null, status: 'error', error });
  });
});
