import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectLastOrder } from '../../features/checkout/store/checkout.reducer';

/**
 * The confirmation screen only exists in the context of an order that was just
 * placed. Orders are deliberately *not* persisted (they contain the customer's
 * name and email — see docs/security-notes.md), so a refresh or a direct visit
 * sends the shopper back to the catalogue rather than showing a hollow page.
 */
export const orderPlacedGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const order = store.selectSignal(selectLastOrder)();
  return order !== null ? true : router.createUrlTree(['/']);
};
