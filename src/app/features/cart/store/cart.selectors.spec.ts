import { describe, expect, it } from 'vitest';
import { makeCartItem } from '../../../../testing/fixtures';
import {
  selectCartIsEmpty,
  selectCartLineCount,
  selectCartQuantityById,
  selectCartSubtotal,
  selectCartSummary,
  selectCartTotal,
  selectCartTotalQuantity,
} from './cart.selectors';

const items = [
  makeCartItem({ id: 1, price: 109.95, quantity: 2 }),
  makeCartItem({ id: 2, price: 55.99, quantity: 1 }),
];

describe('cart selectors', () => {
  it('counts distinct lines and total units separately', () => {
    expect(selectCartLineCount.projector(items)).toBe(2);
    expect(selectCartTotalQuantity.projector(items)).toBe(3);
  });

  it('computes the subtotal from price times quantity', () => {
    expect(selectCartSubtotal.projector(items)).toBe(275.89);
  });

  it('reports an empty cart', () => {
    expect(selectCartIsEmpty.projector([])).toBe(true);
    expect(selectCartTotalQuantity.projector([])).toBe(0);
    expect(selectCartSubtotal.projector([])).toBe(0);
  });

  it('exposes the total, which currently mirrors the subtotal', () => {
    expect(selectCartTotal.projector(items)).toBe(selectCartSubtotal.projector(items));
  });

  it('builds a quantity lookup keyed by product id', () => {
    const quantities = selectCartQuantityById.projector(items);
    expect(quantities.get(1)).toBe(2);
    expect(quantities.get(2)).toBe(1);
    expect(quantities.get(99)).toBeUndefined();
  });

  it('memoises the quantity lookup so an unchanged cart is not remapped', () => {
    // The product grid reads this map on every render; recomputing it would
    // hand every card a new value and force the whole grid to re-render.
    selectCartQuantityById.release();
    const first = selectCartQuantityById.projector(items);
    expect(selectCartQuantityById.projector(items)).toBe(first);
  });

  it('bundles the header view model', () => {
    expect(selectCartSummary.projector(3, 275.89, false)).toEqual({
      totalQuantity: 3,
      subtotal: 275.89,
      isEmpty: false,
    });
  });
});
