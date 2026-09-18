import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { CartLineComponent } from '../../components/cart-line/cart-line';
import { CartInteractionsService } from '../../services/cart-interactions.service';
import {
  selectCartIsEmpty,
  selectCartItems,
  selectCartLineCount,
  selectCartSubtotal,
  selectCartTotal,
  selectCartTotalQuantity,
} from '../../store/cart.selectors';

@Component({
  selector: 'app-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, CartLineComponent, EmptyStateComponent, IconComponent],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
})
export class CartPage {
  private readonly store = inject(Store);
  private readonly cart = inject(CartInteractionsService);

  protected readonly items = this.store.selectSignal(selectCartItems);
  protected readonly isEmpty = this.store.selectSignal(selectCartIsEmpty);
  protected readonly lineCount = this.store.selectSignal(selectCartLineCount);
  protected readonly totalQuantity = this.store.selectSignal(selectCartTotalQuantity);
  protected readonly subtotal = this.store.selectSignal(selectCartSubtotal);
  protected readonly total = this.store.selectSignal(selectCartTotal);

  protected increment(id: number): void {
    this.cart.increment(id);
  }

  protected decrement(id: number): void {
    this.cart.decrement(id);
  }

  protected remove(id: number): void {
    const item = this.items().find((entry) => entry.id === id);
    this.cart.remove(id, item?.title);
  }
}
