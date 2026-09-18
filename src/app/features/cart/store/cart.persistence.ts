import { ActionReducer } from '@ngrx/store';
import { CartItem, MAX_CART_QUANTITY, MIN_CART_QUANTITY } from '../models/cart-item.model';
import { CartState, initialCartState } from './cart.reducer';

export const CART_STORAGE_KEY = 'kibo.cart.v1';

/**
 * Persisted cart contract:
 *
 * - `localStorage` is used (not `sessionStorage`) because a basket is expected
 *   to survive a tab close, and not a cookie because the value is never sent to
 *   a server and would only add weight to every request.
 * - The key is versioned so a future shape change can be ignored rather than
 *   half-migrated.
 * - Everything read back is **untrusted**: a user (or another script on the
 *   origin) can write arbitrary JSON there. It is validated field by field
 *   before it is allowed to become state.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCartItem(raw: unknown): CartItem | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { id, title, price, image, category, quantity } = raw;

  if (typeof id !== 'number' || !Number.isFinite(id)) return null;
  if (typeof title !== 'string' || title.trim().length === 0) return null;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return null;

  const safeQuantity = Math.min(
    Math.max(Math.trunc(quantity), MIN_CART_QUANTITY),
    MAX_CART_QUANTITY,
  );
  const safeImage = typeof image === 'string' && /^https?:\/\//i.test(image) ? image : '';

  return {
    id,
    title: title.slice(0, 2_000),
    price,
    image: safeImage,
    category: typeof category === 'string' ? category.slice(0, 200) : '',
    quantity: safeQuantity,
  };
}

/** Returns the valid subset of a persisted cart; never throws. */
export function parseCartState(serialized: string | null): CartState {
  if (serialized === null) {
    return initialCartState;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return initialCartState;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed['items'])) {
    return initialCartState;
  }

  const items: CartItem[] = [];
  const seen = new Set<number>();
  for (const entry of parsed['items']) {
    const item = parseCartItem(entry);
    // Duplicate ids in the payload would break the "one line per product"
    // invariant the reducer relies on, so later duplicates are dropped.
    if (item !== null && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return { items };
}

export function serializeCartState(state: CartState): string {
  return JSON.stringify({ items: state.items });
}

/**
 * Meta-reducer that hydrates the cart on bootstrap and writes it back after
 * every cart transition. Keeping this at the reducer boundary means persistence
 * cannot drift out of sync with state the way a component-level `subscribe`
 * eventually does.
 */
export function cartPersistenceMetaReducer(
  read: () => string | null,
  write: (value: string) => void,
) {
  return (reducer: ActionReducer<CartState>): ActionReducer<CartState> =>
    (state, action) => {
      // `undefined` state means NgRx is initialising this slice — which it does
      // for more than just INIT/UPDATE, because the feature reducer runs for
      // every action dispatched before the slice exists in the root state.
      // Restoring here (and, crucially, *not* writing) is what stops
      // initialisation from overwriting a saved cart with an empty one.
      if (state === undefined) {
        return reducer(parseCartState(read()), action);
      }
      const nextState = reducer(state, action);
      if (nextState !== state) {
        write(serializeCartState(nextState));
      }
      return nextState;
    };
}
