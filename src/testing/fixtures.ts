import { Product } from '../app/core/models/product.model';
import { CartItem } from '../app/features/cart/models/cart-item.model';

/** Shaped like real Fake Store API entries, with predictable numbers. */
export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'Fjallraven Foldsack No. 1 Backpack',
    price: 109.95,
    description: 'Your perfect pack for everyday use.',
    category: "men's clothing",
    image: 'https://fakestoreapi.com/img/backpack.jpg',
    rating: { rate: 3.9, count: 120 },
    ...overrides,
  };
}

export function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    title: 'Fjallraven Foldsack No. 1 Backpack',
    price: 109.95,
    image: 'https://fakestoreapi.com/img/backpack.jpg',
    category: "men's clothing",
    quantity: 1,
    ...overrides,
  };
}

export const catalogue: readonly Product[] = [
  makeProduct({
    id: 1,
    title: 'Backpack',
    price: 109.95,
    category: "men's clothing",
    rating: { rate: 3.9, count: 120 },
  }),
  makeProduct({
    id: 2,
    title: 'Cotton Jacket',
    price: 55.99,
    category: "men's clothing",
    rating: { rate: 4.7, count: 500 },
  }),
  makeProduct({
    id: 3,
    title: 'Gold Bracelet',
    price: 695,
    category: 'jewelery',
    rating: { rate: 4.6, count: 400 },
  }),
  makeProduct({
    id: 4,
    title: 'Anchor Ring',
    price: 9.99,
    category: 'jewelery',
    rating: { rate: 3, count: 400 },
  }),
  makeProduct({
    id: 5,
    title: 'Portable SSD',
    price: 109,
    category: 'electronics',
    rating: { rate: 2.9, count: 470 },
  }),
];
