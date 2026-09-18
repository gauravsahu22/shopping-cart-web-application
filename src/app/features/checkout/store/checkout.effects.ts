import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { delay, map, tap } from 'rxjs';
import { CartActions } from '../../cart/store/cart.actions';
import { CheckoutActions } from './checkout.actions';
import { createOrderReference } from '../models/order.model';

/** Stands in for the round-trip a real payment authorisation would take. */
const SIMULATED_PAYMENT_MS = 700;

@Injectable()
export class CheckoutEffects {
  private readonly actions$ = inject(Actions);
  private readonly router = inject(Router);

  readonly placeOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CheckoutActions.orderSubmitted),
      delay(SIMULATED_PAYMENT_MS),
      map(({ customer, items, total }) =>
        CheckoutActions.orderPlaced({
          order: {
            reference: createOrderReference(),
            placedAt: new Date().toISOString(),
            items,
            total,
            customerName: customer.fullName,
            email: customer.email,
          },
        }),
      ),
    ),
  );

  /** The basket is emptied only once the order actually exists. */
  readonly clearCart$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CheckoutActions.orderPlaced),
      map(() => CartActions.clearCart()),
    ),
  );

  readonly navigateToConfirmation$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(CheckoutActions.orderPlaced),
        tap(() => void this.router.navigate(['/order-completed'])),
      ),
    { dispatch: false },
  );
}
