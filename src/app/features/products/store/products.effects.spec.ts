import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Action } from '@ngrx/store';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogue, makeProduct } from '../../../../testing/fixtures';
import { ProductApiService } from '../../../core/services/product-api.service';
import { ProductsActions } from './products.actions';
import { ProductsEffects } from './products.effects';
import { productsFeature } from './products.reducer';

describe('ProductsEffects', () => {
  let actions$: Subject<Action>;
  let api: { getProducts: ReturnType<typeof vi.fn>; getProduct: ReturnType<typeof vi.fn> };
  let effects: ProductsEffects;
  let store: MockStore;

  function setup(products: readonly ReturnType<typeof makeProduct>[] = []) {
    actions$ = new Subject();
    api = { getProducts: vi.fn(), getProduct: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ProductsEffects,
        provideMockActions(() => actions$),
        provideMockStore(),
        { provide: ProductApiService, useValue: api },
      ],
    });

    effects = TestBed.inject(ProductsEffects);
    store = TestBed.inject(MockStore);
    store.overrideSelector(productsFeature.selectItems, products);
  }

  beforeEach(() => setup());

  it('loads the catalogue and emits the products', async () => {
    api.getProducts.mockReturnValue(of(catalogue));

    const result = firstValueFrom(effects.loadCatalogue$);
    actions$.next(ProductsActions.catalogueRequested());

    expect(await result).toEqual(ProductsActions.catalogueLoaded({ products: catalogue }));
  });

  it('maps a server failure onto a user-facing error instead of throwing', async () => {
    api.getProducts.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );

    const result = firstValueFrom(effects.loadCatalogue$);
    actions$.next(ProductsActions.catalogueRequested());

    const action = await result;
    expect(action.type).toBe(ProductsActions.catalogueFailed.type);
    expect(action).toMatchObject({ error: { kind: 'server', status: 500 } });
  });

  it('reports a network outage distinctly so the message can be actionable', async () => {
    api.getProducts.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })),
    );

    const result = firstValueFrom(effects.loadCatalogue$);
    actions$.next(ProductsActions.catalogueRequested());

    expect(await result).toMatchObject({ error: { kind: 'offline' } });
  });

  it('stays subscribed after a failure so a retry still works', async () => {
    api.getProducts
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of(catalogue));

    const seen: string[] = [];
    const subscription = effects.loadCatalogue$.subscribe((action) => seen.push(action.type));

    actions$.next(ProductsActions.catalogueRequested());
    actions$.next(ProductsActions.catalogueRequested());
    subscription.unsubscribe();

    expect(seen).toEqual([
      ProductsActions.catalogueFailed.type,
      ProductsActions.catalogueLoaded.type,
    ]);
  });

  it('serves a product from the loaded catalogue without a second request', async () => {
    store.overrideSelector(productsFeature.selectItems, catalogue);
    store.refreshState();

    const result = firstValueFrom(effects.loadProduct$);
    actions$.next(ProductsActions.productRequested({ id: 3 }));

    expect(await result).toEqual(ProductsActions.productLoaded({ product: catalogue[2] }));
    expect(api.getProduct).not.toHaveBeenCalled();
  });

  it('fetches a product that is not in the catalogue', async () => {
    const product = makeProduct({ id: 42, title: 'Direct visit' });
    api.getProduct.mockReturnValue(of(product));

    const result = firstValueFrom(effects.loadProduct$);
    actions$.next(ProductsActions.productRequested({ id: 42 }));

    expect(await result).toEqual(ProductsActions.productLoaded({ product }));
    expect(api.getProduct).toHaveBeenCalledWith(42);
  });

  it('turns a missing product into a not-found error', async () => {
    api.getProduct.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    );

    const result = firstValueFrom(effects.loadProduct$);
    actions$.next(ProductsActions.productRequested({ id: 999 }));

    expect(await result).toMatchObject({
      type: ProductsActions.productFailed.type,
      error: { kind: 'not-found' },
    });
  });
});
