import { Product } from '../../../core/models/product.model';

/**
 * A cart line keeps its own snapshot of the product fields it displays.
 *
 * The cart must render correctly on a cold load of `/cart` (no catalogue
 * fetched yet) and must not break if a product later disappears from the API.
 * Price is captured at add-to-cart time, which is also how a real basket
 * behaves until checkout re-prices it server-side.
 */
export interface CartItem {
  readonly id: number;
  readonly title: string;
  readonly price: number;
  readonly image: string;
  readonly category: string;
  readonly quantity: number;
}

export const MIN_CART_QUANTITY = 1;
/** Upper bound per line; keeps a stuck key-repeat from producing absurd totals. */
export const MAX_CART_QUANTITY = 99;

export function toCartItem(product: Product, quantity: number): CartItem {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    image: product.image,
    category: product.category,
    quantity: clampQuantity(quantity),
  };
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_CART_QUANTITY;
  }
  return Math.min(Math.max(Math.trunc(quantity), MIN_CART_QUANTITY), MAX_CART_QUANTITY);
}
