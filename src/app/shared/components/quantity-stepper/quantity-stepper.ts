import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';
import {
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
} from '../../../features/cart/models/cart-item.model';

/**
 * Quantity control for a cart line.
 *
 * It is presentational: it emits intent and renders the quantity it is given,
 * so it can never hold a copy of cart state that drifts from the store.
 */
@Component({
  selector: 'app-quantity-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="stepper" role="group" [attr.aria-label]="'Quantity for ' + label()">
      @if (quantity() <= min) {
        <button type="button" class="stepper__btn" (click)="remove.emit()">
          <app-icon name="trash" [size]="16" />
          <span class="visually-hidden">Remove {{ label() }} from cart</span>
        </button>
      } @else {
        <button type="button" class="stepper__btn" (click)="decrement.emit()">
          <app-icon name="minus" [size]="16" />
          <span class="visually-hidden">Decrease quantity of {{ label() }}</span>
        </button>
      }

      <output class="stepper__value" [attr.aria-label]="quantity() + ' in cart'">
        {{ quantity() }}
      </output>

      <button type="button" class="stepper__btn" [disabled]="atMax()" (click)="increment.emit()">
        <app-icon name="plus" [size]="16" />
        <span class="visually-hidden">Increase quantity of {{ label() }}</span>
      </button>
    </div>
  `,
  styleUrl: './quantity-stepper.scss',
})
export class QuantityStepperComponent {
  protected readonly min = MIN_CART_QUANTITY;

  readonly quantity = input.required<number>();
  /** Product name, used to build accessible names for the icon buttons. */
  readonly label = input.required<string>();

  readonly increment = output<void>();
  readonly decrement = output<void>();
  readonly remove = output<void>();

  protected readonly atMax = computed(() => this.quantity() >= MAX_CART_QUANTITY);
}
