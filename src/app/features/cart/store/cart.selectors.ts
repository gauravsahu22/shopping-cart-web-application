import { createSelector } from '@ngrx/store';
import { sumLineTotals } from '../../../core/utils/money';
import { CartItem } from '../models/cart-item.model';
import { cartFeature } from './cart.reducer';

/**
 * Cart totals are derived here and nowhere else. Components read the numbers
 * they need; no template or service recomputes a subtotal.
 */
export const selectCartItems = cartFeature.selectItems;

/**
 * Quantity lookup as a memoised map.
 *
 * The product grid needs "how many of product X are in the cart" for every
 * visible card. A selector *factory* per card would allocate a new selector on
 * each change-detection pass and defeat memoisation entirely
 * (see docs/performance-notes.md); one shared map does the job in O(1) per card.
 */
export const selectCartQuantityById = createSelector(
  selectCartItems,
  (items): ReadonlyMap<number, number> =>
    new Map(items.map((item: CartItem) => [item.id, item.quantity])),
);

export const selectCartLineCount = createSelector(selectCartItems, (items) => items.length);

export const selectCartTotalQuantity = createSelector(selectCartItems, (items) =>
  items.reduce((total, item) => total + item.quantity, 0),
);

export const selectCartSubtotal = createSelector(selectCartItems, (items) => sumLineTotals(items));

/**
 * Shipping and tax are presentational placeholders: the Fake Store API has no
 * pricing engine, so the total intentionally equals the subtotal rather than
 * inventing rates that would be wrong in production.
 */
export const selectCartTotal = selectCartSubtotal;

export const selectCartIsEmpty = createSelector(selectCartItems, (items) => items.length === 0);

/** One view model for the header, so it subscribes to a single stream. */
export const selectCartSummary = createSelector(
  selectCartTotalQuantity,
  selectCartSubtotal,
  selectCartIsEmpty,
  (totalQuantity, subtotal, isEmpty) => ({ totalQuantity, subtotal, isEmpty }),
);
