import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../../../../core/models/product.model';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { ProductImageComponent } from '../../../../shared/components/product-image/product-image';
import { QuantityStepperComponent } from '../../../../shared/components/quantity-stepper/quantity-stepper';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating';

/** Ratings at or above this are surfaced as a badge. Derived from real API data. */
const TOP_RATED_THRESHOLD = 4.5;

/**
 * Purely presentational. It receives the product and its current cart quantity
 * and emits intent; it never reads the store, which keeps it trivially testable
 * and lets `OnPush` skip it whenever neither input changed.
 */
@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterLink,
    IconComponent,
    ProductImageComponent,
    QuantityStepperComponent,
    StarRatingComponent,
  ],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly quantityInCart = input(0);
  /** First row of the grid renders eagerly to protect the largest paint. */
  readonly priority = input(false);

  readonly add = output<Product>();
  readonly increment = output<number>();
  readonly decrement = output<number>();
  readonly remove = output<number>();

  protected readonly inCart = computed(() => this.quantityInCart() > 0);
  protected readonly isTopRated = computed(() => this.product().rating.rate >= TOP_RATED_THRESHOLD);
}
