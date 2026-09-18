import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  CategoryFilter,
  PRODUCT_SORT_OPTIONS,
  ProductSort,
} from '../../../../core/models/product.model';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { CategoryOption } from '../../store/products.selectors';

/** Long enough to skip intermediate keystrokes, short enough to feel instant. */
const SEARCH_DEBOUNCE_MS = 200;

@Component({
  selector: 'app-product-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './product-filters.html',
  styleUrl: './product-filters.scss',
})
export class ProductFiltersComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly search = input('');
  readonly category = input<CategoryFilter>(null);
  readonly sort = input<ProductSort>('featured');
  readonly categories = input.required<readonly CategoryOption[]>();
  readonly resultCount = input(0);
  readonly hasActiveFilters = input(false);

  readonly searchChanged = output<string>();
  readonly categoryChanged = output<CategoryFilter>();
  readonly sortChanged = output<ProductSort>();
  readonly filtersCleared = output<void>();

  protected readonly sortOptions = PRODUCT_SORT_OPTIONS;
  protected readonly searchControl = new FormControl('', { nonNullable: true });

  constructor() {
    // Store -> control, so "Clear filters" (or any external reset) is reflected
    // without the control becoming a second source of truth.
    effect(() => {
      const value = this.search();
      if (value !== this.searchControl.value) {
        this.searchControl.setValue(value, { emitEvent: false });
      }
    });

    this.searchControl.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.searchChanged.emit(value));
  }

  protected onSortChange(value: string): void {
    this.sortChanged.emit(value as ProductSort);
  }
}
