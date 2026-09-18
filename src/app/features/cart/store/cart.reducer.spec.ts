import { describe, expect, it } from 'vitest';
import { makeCartItem, makeProduct } from '../../../../testing/fixtures';
import { MAX_CART_QUANTITY } from '../models/cart-item.model';
import { CartActions } from './cart.actions';
import { CartState, cartReducer, initialCartState } from './cart.reducer';

const product = makeProduct();
const other = makeProduct({ id: 2, title: 'Cotton Jacket', price: 55.99 });

function stateWith(...items: CartState['items']): CartState {
  return { items };
}

describe('cartReducer', () => {
  it('adds a product to an empty cart', () => {
    const state = cartReducer(initialCartState, CartActions.addItem({ product, quantity: 1 }));
    expect(state.items).toEqual([
      expect.objectContaining({ id: 1, title: product.title, price: 109.95, quantity: 1 }),
    ]);
  });

  it('increases the quantity instead of duplicating an existing product', () => {
    let state = cartReducer(initialCartState, CartActions.addItem({ product, quantity: 1 }));
    state = cartReducer(state, CartActions.addItem({ product, quantity: 1 }));

    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
  });

  it('keeps separate lines for different products, in insertion order', () => {
    let state = cartReducer(initialCartState, CartActions.addItem({ product, quantity: 1 }));
    state = cartReducer(state, CartActions.addItem({ product: other, quantity: 3 }));

    expect(state.items.map((item) => [item.id, item.quantity])).toEqual([
      [1, 1],
      [2, 3],
    ]);
  });

  it('is deterministic under a burst of repeated increments', () => {
    // Stands in for a shopper hammering the "+" button: each reduction depends
    // only on the previous state, so no update can be lost to a stale snapshot.
    const state = Array.from({ length: 20 }).reduce<CartState>(
      (current) => cartReducer(current, CartActions.incrementItem({ id: 1 })),
      stateWith(makeCartItem({ quantity: 1 })),
    );

    expect(state.items[0].quantity).toBe(21);
  });

  it('never lets a quantity fall below one', () => {
    let state = stateWith(makeCartItem({ quantity: 1 }));
    state = cartReducer(state, CartActions.decrementItem({ id: 1 }));
    state = cartReducer(state, CartActions.decrementItem({ id: 1 }));

    expect(state.items[0].quantity).toBe(1);
  });

  it('caps a quantity at the maximum', () => {
    const state = cartReducer(
      stateWith(makeCartItem({ quantity: MAX_CART_QUANTITY })),
      CartActions.incrementItem({ id: 1 }),
    );
    expect(state.items[0].quantity).toBe(MAX_CART_QUANTITY);
  });

  it('clamps an out-of-range explicit quantity', () => {
    const state = cartReducer(
      stateWith(makeCartItem({ quantity: 2 })),
      CartActions.setQuantity({ id: 1, quantity: -5 }),
    );
    expect(state.items[0].quantity).toBe(1);
  });

  it('returns the identical state object when an action changes nothing', () => {
    // Referential stability is what lets OnPush components skip re-rendering.
    const before = stateWith(makeCartItem({ quantity: 1 }));
    const after = cartReducer(before, CartActions.decrementItem({ id: 1 }));
    expect(after).toBe(before);
  });

  it('ignores quantity changes for a product that is not in the cart', () => {
    const before = stateWith(makeCartItem({ quantity: 1 }));
    expect(cartReducer(before, CartActions.incrementItem({ id: 99 }))).toBe(before);
  });

  it('removes a line', () => {
    const state = cartReducer(
      stateWith(makeCartItem(), makeCartItem({ id: 2 })),
      CartActions.removeItem({ id: 1 }),
    );
    expect(state.items.map((item) => item.id)).toEqual([2]);
  });

  it('removing the final line empties the cart', () => {
    const state = cartReducer(stateWith(makeCartItem()), CartActions.removeItem({ id: 1 }));
    expect(state.items).toEqual([]);
  });

  it('clears the whole cart', () => {
    const state = cartReducer(
      stateWith(makeCartItem(), makeCartItem({ id: 2 })),
      CartActions.clearCart(),
    );
    expect(state).toEqual(initialCartState);
  });

  it('replaces state with a restored cart', () => {
    const restored = [makeCartItem({ id: 9, quantity: 4 })];
    const state = cartReducer(
      stateWith(makeCartItem()),
      CartActions.cartRestored({ items: restored }),
    );
    expect(state.items).toEqual(restored);
  });
});
