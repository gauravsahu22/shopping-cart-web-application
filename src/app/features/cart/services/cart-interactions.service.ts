import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Product } from '../../../core/models/product.model';
import { ToastService } from '../../../core/services/toast.service';
import { CartActions } from '../store/cart.actions';

/**
 * One place where "add to cart" means dispatch + confirm. The product list, the
 * product detail page and the cart page all route through here so the behaviour
 * cannot drift between them.
 */
@Injectable({ providedIn: 'root' })
export class CartInteractionsService {
  private readonly store = inject(Store);
  private readonly toasts = inject(ToastService);

  add(product: Product, quantity = 1): void {
    this.store.dispatch(CartActions.addItem({ product, quantity }));
    this.toasts.show(`${product.title} added to your cart.`);
  }

  increment(id: number): void {
    this.store.dispatch(CartActions.incrementItem({ id }));
  }

  decrement(id: number): void {
    this.store.dispatch(CartActions.decrementItem({ id }));
  }

  remove(id: number, title?: string): void {
    this.store.dispatch(CartActions.removeItem({ id }));
    this.toasts.show(title ? `${title} removed from your cart.` : 'Item removed from your cart.');
  }
}
