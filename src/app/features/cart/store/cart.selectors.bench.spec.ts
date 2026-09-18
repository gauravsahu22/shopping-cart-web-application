import { createSelector } from '@ngrx/store';
import { describe, expect, it } from 'vitest';
import { makeCartItem } from '../../../../testing/fixtures';
import { CartItem } from '../models/cart-item.model';

/**
 * Measurement, not a feature test.
 *
 * The product grid needs "how many of product X is in the cart" for every
 * visible card. Two designs were considered; this spec counts the work each one
 * does so the choice recorded in docs/performance-notes.md rests on numbers
 * rather than on intuition.
 *
 * Scenario: a 24-card grid, and a shopper pressing "+" 20 times.
 */
const CARDS = 24;
const CLICKS = 20;

const items: CartItem[] = Array.from({ length: 6 }, (_, index) =>
  makeCartItem({ id: index + 1, quantity: 1 }),
);

describe('cart quantity lookup strategies', () => {
  it('shipped design: one memoised map, read O(1) per card', () => {
    let projectorCalls = 0;
    const selectQuantityById = createSelector(
      (state: { items: CartItem[] }) => state.items,
      (cartItems): ReadonlyMap<number, number> => {
        projectorCalls += 1;
        return new Map(cartItems.map((item) => [item.id, item.quantity]));
      },
    );

    let state = { items };
    for (let click = 0; click < CLICKS; click += 1) {
      state = {
        items: state.items.map((item) =>
          item.id === 1 ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      };
      const quantities = selectQuantityById(state);
      // Every card reads the same already-computed map.
      for (let card = 0; card < CARDS; card += 1) {
        quantities.get(card + 1);
      }
    }

    // One projector run per cart change — the grid size does not matter.
    expect(projectorCalls).toBe(CLICKS);
  });

  it('rejected design: a selector factory per card defeats memoisation', () => {
    let projectorCalls = 0;
    const selectQuantityFor = (id: number) =>
      createSelector(
        (state: { items: CartItem[] }) => state.items,
        (cartItems) => {
          projectorCalls += 1;
          return cartItems.find((item) => item.id === id)?.quantity ?? 0;
        },
      );

    let state = { items };
    for (let click = 0; click < CLICKS; click += 1) {
      state = {
        items: state.items.map((item) =>
          item.id === 1 ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      };
      // A factory called from a template allocates a fresh selector each pass,
      // so nothing is ever cached and every card scans the cart again.
      for (let card = 0; card < CARDS; card += 1) {
        selectQuantityFor(card + 1)(state);
      }
    }

    expect(projectorCalls).toBe(CLICKS * CARDS);
  });

  it('the memoised map also skips work when the cart is unchanged', () => {
    let projectorCalls = 0;
    const selectQuantityById = createSelector(
      (state: { items: CartItem[] }) => state.items,
      (cartItems) => {
        projectorCalls += 1;
        return new Map(cartItems.map((item) => [item.id, item.quantity]));
      },
    );

    const state = { items };
    for (let pass = 0; pass < 50; pass += 1) {
      selectQuantityById(state);
    }

    // 50 reads, one computation: unrelated re-renders cost nothing.
    expect(projectorCalls).toBe(1);
  });
});
