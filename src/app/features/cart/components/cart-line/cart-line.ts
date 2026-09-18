import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { lineTotal } from '../../../../core/utils/money';
import { ProductImageComponent } from '../../../../shared/components/product-image/product-image';
import { QuantityStepperComponent } from '../../../../shared/components/quantity-stepper/quantity-stepper';
import { CartItem } from '../../models/cart-item.model';

@Component({
  selector: 'app-cart-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, ProductImageComponent, QuantityStepperComponent],
  templateUrl: './cart-line.html',
  styleUrl: './cart-line.scss',
})
export class CartLineComponent {
  readonly item = input.required<CartItem>();

  readonly increment = output<number>();
  readonly decrement = output<number>();
  readonly remove = output<number>();

  /** Uses the shared money helper so the line total matches the cart total exactly. */
  protected readonly total = computed(() => lineTotal(this.item().price, this.item().quantity));
}
