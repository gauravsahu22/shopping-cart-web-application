import { createFeature, createReducer, on } from '@ngrx/store';
import { Order } from '../models/order.model';
import { CheckoutActions } from './checkout.actions';

export interface CheckoutState {
  readonly lastOrder: Order | null;
  readonly submitting: boolean;
}

export const initialCheckoutState: CheckoutState = { lastOrder: null, submitting: false };

export const checkoutFeature = createFeature({
  name: 'checkout',
  reducer: createReducer(
    initialCheckoutState,
    on(CheckoutActions.orderSubmitted, (state) => ({ ...state, submitting: true })),
    on(CheckoutActions.orderPlaced, (_state, { order }) => ({
      lastOrder: order,
      submitting: false,
    })),
    on(CheckoutActions.confirmationDismissed, () => initialCheckoutState),
  ),
});

export const { selectLastOrder, selectSubmitting } = checkoutFeature;
export const { name: checkoutFeatureKey, reducer: checkoutReducer } = checkoutFeature;
