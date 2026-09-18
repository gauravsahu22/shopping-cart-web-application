import { describe, expect, it, vi } from 'vitest';
import { makeCartItem, makeProduct } from '../../../../testing/fixtures';
import { CartActions } from './cart.actions';
import { cartPersistenceMetaReducer, parseCartState, serializeCartState } from './cart.persistence';
import { CartState, cartReducer, initialCartState } from './cart.reducer';

const savedCart = serializeCartState({ items: [makeCartItem({ quantity: 2 })] });

describe('parseCartState', () => {
  it('restores a cart written by this application', () => {
    expect(parseCartState(savedCart).items).toEqual([makeCartItem({ quantity: 2 })]);
  });

  it('returns an empty cart when nothing is stored', () => {
    expect(parseCartState(null)).toEqual(initialCartState);
  });

  it.each([
    ['malformed JSON', '{"items":['],
    ['a JSON primitive', '"cart"'],
    ['an array at the root', '[]'],
    ['a missing items key', '{"lines":[]}'],
    ['items that are not an array', '{"items":{"0":{}}}'],
    ['plain text', 'not json at all'],
  ])('falls back to an empty cart for %s', (_label, raw) => {
    expect(parseCartState(raw)).toEqual(initialCartState);
  });

  it('keeps valid lines and drops tampered ones', () => {
    const tampered = JSON.stringify({
      items: [
        makeCartItem({ id: 1, quantity: 2 }),
        { id: 'two', title: 'x', price: 1, quantity: 1 },
        { id: 3, title: 'Missing price', quantity: 1 },
        makeCartItem({ id: 4, quantity: 1 }),
      ],
    });
    expect(parseCartState(tampered).items.map((item) => item.id)).toEqual([1, 4]);
  });

  it('clamps a tampered quantity rather than trusting it', () => {
    const tampered = JSON.stringify({ items: [{ ...makeCartItem(), quantity: 1e6 }] });
    expect(parseCartState(tampered).items[0].quantity).toBe(99);
  });

  it('rejects a negative quantity', () => {
    const tampered = JSON.stringify({ items: [{ ...makeCartItem(), quantity: -4 }] });
    expect(parseCartState(tampered).items[0].quantity).toBe(1);
  });

  it('strips an image URL with an unsafe scheme', () => {
    const tampered = JSON.stringify({
      items: [{ ...makeCartItem(), image: 'javascript:alert(document.cookie)' }],
    });
    expect(parseCartState(tampered).items[0].image).toBe('');
  });

  it('drops duplicate ids so the one-line-per-product invariant holds', () => {
    const tampered = JSON.stringify({
      items: [makeCartItem({ quantity: 1 }), makeCartItem({ quantity: 5 })],
    });
    const restored = parseCartState(tampered);
    expect(restored.items).toHaveLength(1);
    expect(restored.items[0].quantity).toBe(1);
  });
});

describe('cartPersistenceMetaReducer', () => {
  function setup(stored: string | null) {
    const write = vi.fn();
    const reducer = cartPersistenceMetaReducer(() => stored, write)(cartReducer);
    return { reducer, write };
  }

  it('hydrates the cart when the slice initialises', () => {
    const { reducer } = setup(savedCart);
    const state = reducer(undefined, { type: '@ngrx/store/init' }) as CartState;
    expect(state.items[0].quantity).toBe(2);
  });

  it('does not write while initialising', () => {
    // Regression guard: initialisation used to overwrite a saved cart with an
    // empty one, so the basket survived a reload but not the reload after that.
    const { reducer, write } = setup(savedCart);
    reducer(undefined, { type: '@ngrx/effects/init' });
    expect(write).not.toHaveBeenCalled();
  });

  it('persists the cart after a change', () => {
    const { reducer, write } = setup(null);
    reducer({ items: [] }, CartActions.addItem({ product: makeProduct(), quantity: 1 }));

    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(write.mock.calls[0][0] as string).items).toHaveLength(1);
  });

  it('does not write when an action leaves the cart unchanged', () => {
    const { reducer, write } = setup(null);
    reducer({ items: [makeCartItem({ quantity: 1 })] }, CartActions.decrementItem({ id: 1 }));
    expect(write).not.toHaveBeenCalled();
  });

  it('round-trips state through serialise and parse', () => {
    const state: CartState = { items: [makeCartItem({ quantity: 3 })] };
    expect(parseCartState(serializeCartState(state))).toEqual(state);
  });
});
