import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { lineTotal } from '../../../../core/utils/money';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { CartItem } from '../../../cart/models/cart-item.model';
import { selectLastOrder } from '../../store/checkout.reducer';

@Component({
  selector: 'app-order-completed-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, RouterLink, IconComponent],
  templateUrl: './order-completed-page.html',
  styleUrl: './order-completed-page.scss',
})
export class OrderCompletedPage {
  private readonly store = inject(Store);

  /** Guaranteed non-null by `orderPlacedGuard`. */
  protected readonly order = this.store.selectSignal(selectLastOrder);

  protected lineTotal(item: CartItem): number {
    return lineTotal(item.price, item.quantity);
  }
}
