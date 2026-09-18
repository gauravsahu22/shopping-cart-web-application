import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder cards that match the real card's geometry, so the layout does not
 * jump when products arrive.
 */
@Component({
  selector: 'app-product-grid-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" aria-hidden="true">
      @for (card of placeholders(); track $index) {
        <div class="card skeleton-card">
          <div class="skeleton skeleton-card__media"></div>
          <div class="skeleton-card__body">
            <div class="skeleton skeleton-card__line skeleton-card__line--xs"></div>
            <div class="skeleton skeleton-card__line"></div>
            <div class="skeleton skeleton-card__line skeleton-card__line--sm"></div>
            <div class="skeleton skeleton-card__button"></div>
          </div>
        </div>
      }
    </div>
    <p class="visually-hidden" role="status">Loading products…</p>
  `,
  styleUrl: './product-grid-skeleton.scss',
})
export class ProductGridSkeletonComponent {
  readonly count = input(8);
  protected placeholders(): readonly number[] {
    return Array.from({ length: this.count() }, (_, index) => index);
  }
}
