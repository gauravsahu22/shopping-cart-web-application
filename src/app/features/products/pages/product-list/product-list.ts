import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { CategoryFilter, Product, ProductSort } from '../../../../core/models/product.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state';
import { CartInteractionsService } from '../../../cart/services/cart-interactions.service';
import {
  selectCartQuantityById,
  selectCartTotalQuantity,
} from '../../../cart/store/cart.selectors';
import { ProductCardComponent } from '../../components/product-card/product-card';
import { ProductFiltersComponent } from '../../components/product-filters/product-filters';
import { ProductGridSkeletonComponent } from '../../components/product-grid-skeleton/product-grid-skeleton';
import { ProductsActions } from '../../store/products.actions';
import {
  selectAllProducts,
  selectCategoryOptions,
  selectHasActiveFilters,
  selectProductPage,
  selectProductQuery,
  selectProductsError,
  selectProductsStatus,
} from '../../store/products.selectors';

/** Cards above the fold skip lazy-loading so the first paint is not delayed. */
const EAGER_IMAGE_COUNT = 4;

@Component({
  selector: 'app-product-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ProductCardComponent,
    ProductFiltersComponent,
    ProductGridSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductListPage {
  private readonly store = inject(Store);
  private readonly cart = inject(CartInteractionsService);

  protected readonly eagerImageCount = EAGER_IMAGE_COUNT;

  protected readonly status = this.store.selectSignal(selectProductsStatus);
  protected readonly error = this.store.selectSignal(selectProductsError);
  protected readonly page = this.store.selectSignal(selectProductPage);
  protected readonly query = this.store.selectSignal(selectProductQuery);
  protected readonly categories = this.store.selectSignal(selectCategoryOptions);
  protected readonly hasActiveFilters = this.store.selectSignal(selectHasActiveFilters);
  protected readonly catalogue = this.store.selectSignal(selectAllProducts);
  protected readonly cartQuantity = this.store.selectSignal(selectCartTotalQuantity);

  /**
   * A single memoised map for the whole grid. Reading it per card is O(1) and,
   * critically, does not create a new selector instance per card
   * (see docs/performance-notes.md).
   */
  protected readonly cartQuantities = this.store.selectSignal(selectCartQuantityById);

  constructor() {
    // Re-entering the route with a loaded catalogue must not refetch; the effect
    // also ignores requests while one is already in flight.
    if (this.status() === 'idle') {
      this.store.dispatch(ProductsActions.catalogueRequested());
    }
  }

  protected retry(): void {
    this.store.dispatch(ProductsActions.catalogueRequested());
  }

  protected onSearch(search: string): void {
    this.store.dispatch(ProductsActions.searchChanged({ search }));
  }

  protected onCategory(category: CategoryFilter): void {
    this.store.dispatch(ProductsActions.categoryChanged({ category }));
  }

  protected onSort(sort: ProductSort): void {
    this.store.dispatch(ProductsActions.sortChanged({ sort }));
  }

  protected onClearFilters(): void {
    this.store.dispatch(ProductsActions.filtersCleared());
  }

  protected loadMore(): void {
    this.store.dispatch(ProductsActions.nextPageRequested());
  }

  protected showAll(): void {
    this.store.dispatch(ProductsActions.allPagesRequested());
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

  protected quantityFor(id: number): number {
    return this.cartQuantities().get(id) ?? 0;
  }
}
