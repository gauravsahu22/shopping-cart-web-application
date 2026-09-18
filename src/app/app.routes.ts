import { Routes } from '@angular/router';
import { orderPlacedGuard } from './core/guards/order-placed.guard';

/**
 * Every route is lazily loaded. The catalogue is the home page, so its chunk is
 * fetched immediately, while the cart, checkout and confirmation screens stay
 * out of the initial bundle until a shopper actually goes there.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Kibo Goods — curated marketplace',
    loadComponent: () =>
      import('./features/products/pages/product-list/product-list').then((m) => m.ProductListPage),
  },
  {
    path: 'products/:id',
    title: 'Product — Kibo Goods',
    loadComponent: () =>
      import('./features/products/pages/product-detail/product-detail').then(
        (m) => m.ProductDetailPage,
      ),
  },
  {
    path: 'cart',
    title: 'Your cart — Kibo Goods',
    loadComponent: () => import('./features/cart/pages/cart/cart-page').then((m) => m.CartPage),
  },
  {
    path: 'checkout',
    title: 'Checkout — Kibo Goods',
    loadComponent: () =>
      import('./features/checkout/pages/checkout/checkout-page').then((m) => m.CheckoutPage),
  },
  {
    path: 'order-completed',
    title: 'Order completed — Kibo Goods',
    canActivate: [orderPlacedGuard],
    loadComponent: () =>
      import('./features/checkout/pages/order-completed/order-completed-page').then(
        (m) => m.OrderCompletedPage,
      ),
  },
  { path: '**', redirectTo: '' },
];
