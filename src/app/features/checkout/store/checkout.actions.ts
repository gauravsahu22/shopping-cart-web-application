import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { CartItem } from '../../cart/models/cart-item.model';
import { CustomerDetails, Order } from '../models/order.model';

export const CheckoutActions = createActionGroup({
  source: 'Checkout',
  events: {
    'Order Submitted': props<{
      customer: CustomerDetails;
      items: readonly CartItem[];
      total: number;
    }>(),
    'Order Placed': props<{ order: Order }>(),
    'Confirmation Dismissed': emptyProps(),
  },
});
