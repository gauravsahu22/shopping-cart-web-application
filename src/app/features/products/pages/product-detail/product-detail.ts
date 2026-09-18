import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { Product } from '../../../../core/models/product.model';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { ProductImageComponent } from '../../../../shared/components/product-image/product-image';
import { QuantityStepperComponent } from '../../../../shared/components/quantity-stepper/quantity-stepper';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating';
import { CartInteractionsService } from '../../../cart/services/cart-interactions.service';
import { selectCartQuantityById } from '../../../cart/store/cart.selectors';
import { ProductsActions } from '../../store/products.actions';
import { selectProductDetail } from '../../store/products.selectors';

@Component({
  selector: 'app-product-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterLink,
    ErrorStateComponent,
    IconComponent,
    ProductImageComponent,
    QuantityStepperComponent,
    StarRatingComponent,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetailPage {
  private readonly store = inject(Store);
  private readonly cart = inject(CartInteractionsService);

  /** Bound from the route via `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  protected readonly detail = this.store.selectSignal(selectProductDetail);
  private readonly quantities = this.store.selectSignal(selectCartQuantityById);

  protected readonly product = computed(() => this.detail().product);
  protected readonly quantityInCart = computed(() => {
    const product = this.product();
    return product === null ? 0 : (this.quantities().get(product.id) ?? 0);
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      if (Number.isInteger(id) && id > 0) {
        this.store.dispatch(ProductsActions.productRequested({ id }));
      } else {
        this.store.dispatch(
          ProductsActions.productFailed({
            error: { kind: 'not-found', message: 'That product does not exist.' },
          }),
        );
      }
    });
  }

  protected retry(): void {
    this.store.dispatch(ProductsActions.productRequested({ id: Number(this.id()) }));
  }

  protected addToCart(product: Product): void {
    this.cart.add(product);
  }

  protected increment(id: number): void {
    this.cart.increment(id);
  }

  protected decrement(id: number): void {
    this.cart.decrement(id);
  }

  protected remove(id: number): void {
    this.cart.remove(id);
  }
}
