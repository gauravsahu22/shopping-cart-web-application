import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, of, switchMap, take } from 'rxjs';
import { toAppError } from '../../../core/services/api-error';
import { ProductApiService } from '../../../core/services/product-api.service';
import { ProductsActions } from './products.actions';
import { selectAllProducts } from './products.selectors';

@Injectable()
export class ProductsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ProductApiService);
  private readonly store = inject(Store);

  /**
   * `exhaustMap`: while a catalogue request is in flight, repeated retry clicks
   * are ignored rather than queued or raced.
   */
  readonly loadCatalogue$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductsActions.catalogueRequested),
      exhaustMap(() =>
        this.api.getProducts().pipe(
          map((products) => ProductsActions.catalogueLoaded({ products })),
          catchError((error: unknown) =>
            of(ProductsActions.catalogueFailed({ error: toAppError(error) })),
          ),
        ),
      ),
    ),
  );

  /**
   * `switchMap`: navigating quickly between two products should render the last
   * one requested, not whichever response happens to arrive last.
   */
  readonly loadProduct$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductsActions.productRequested),
      switchMap(({ id }) =>
        this.store.select(selectAllProducts).pipe(
          take(1),
          switchMap((products) => {
            const cached = products.find((product) => product.id === id);
            if (cached !== undefined) {
              return of(ProductsActions.productLoaded({ product: cached }));
            }
            return this.api.getProduct(id).pipe(
              map((product) => ProductsActions.productLoaded({ product })),
              catchError((error: unknown) =>
                of(ProductsActions.productFailed({ error: toAppError(error) })),
              ),
            );
          }),
        ),
      ),
    ),
  );
}
