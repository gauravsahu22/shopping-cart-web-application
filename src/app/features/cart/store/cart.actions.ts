import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Product } from '../../../core/models/product.model';
import { CartItem } from '../models/cart-item.model';

export const CartActions = createActionGroup({
  source: 'Cart',
  events: {
    'Add Item': props<{ product: Product; quantity: number }>(),
    'Increment Item': props<{ id: number }>(),
    'Decrement Item': props<{ id: number }>(),
    'Set Quantity': props<{ id: number; quantity: number }>(),
    'Remove Item': props<{ id: number }>(),
    'Clear Cart': emptyProps(),
    /** Emitted once at startup with whatever survived persistence validation. */
    'Cart Restored': props<{ items: readonly CartItem[] }>(),
  },
});
