import { createFeature, createReducer, on } from '@ngrx/store';
import {
  CartItem,
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
  clampQuantity,
  toCartItem,
} from '../models/cart-item.model';
import { CartActions } from './cart.actions';

export interface CartState {
  /** Insertion-ordered lines. One entry per product id — never duplicated. */
  readonly items: readonly CartItem[];
}

export const initialCartState: CartState = { items: [] };

/**
 * Every transition is a pure function of the previous state, so a burst of
 * rapid clicks collapses into a deterministic sequence of reductions rather
 * than racing against a stale snapshot held by a component.
 */
function upsert(items: readonly CartItem[], product: CartItem): readonly CartItem[] {
  const index = items.findIndex((item) => item.id === product.id);
  if (index === -1) {
    return [...items, product];
  }
  const existing = items[index];
  const next = [...items];
  next[index] = { ...existing, quantity: clampQuantity(existing.quantity + product.quantity) };
  return next;
}

function changeQuantity(
  items: readonly CartItem[],
  id: number,
  change: (quantity: number) => number,
): readonly CartItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    return items;
  }
  const existing = items[index];
  const quantity = clampQuantity(change(existing.quantity));
  if (quantity === existing.quantity) {
    return items;
  }
  const next = [...items];
  next[index] = { ...existing, quantity };
  return next;
}

/**
 * Returns the *previous* state object when the line-up is unchanged. Without
 * this, a no-op action (decrementing a line that is already at 1, incrementing
 * a product that is not in the cart) produces a new state object, which both
 * defeats referential-equality checks and triggers a pointless rewrite of
 * `localStorage` in the persistence meta-reducer.
 */
function withItems(state: CartState, items: readonly CartItem[]): CartState {
  return items === state.items ? state : { items };
}

export const cartFeature = createFeature({
  name: 'cart',
  reducer: createReducer(
    initialCartState,
    on(CartActions.addItem, (state, { product, quantity }) =>
      withItems(state, upsert(state.items, toCartItem(product, quantity))),
    ),
    on(CartActions.incrementItem, (state, { id }) =>
      withItems(
        state,
        changeQuantity(state.items, id, (quantity) => Math.min(quantity + 1, MAX_CART_QUANTITY)),
      ),
    ),
    on(CartActions.decrementItem, (state, { id }) =>
      // Clamped at the minimum: emptying a line is an explicit "remove", never
      // an accidental side effect of holding down the minus button.
      withItems(
        state,
        changeQuantity(state.items, id, (quantity) => Math.max(quantity - 1, MIN_CART_QUANTITY)),
      ),
    ),
    on(CartActions.setQuantity, (state, { id, quantity }) =>
      withItems(
        state,
        changeQuantity(state.items, id, () => quantity),
      ),
    ),
    on(CartActions.removeItem, (state, { id }) => {
      const items = state.items.filter((item) => item.id !== id);
      return items.length === state.items.length ? state : { items };
    }),
    on(CartActions.clearCart, (state) => (state.items.length === 0 ? state : initialCartState)),
    on(CartActions.cartRestored, (_state, { items }) => ({ items: [...items] })),
  ),
});

export const { name: cartFeatureKey, reducer: cartReducer } = cartFeature;
