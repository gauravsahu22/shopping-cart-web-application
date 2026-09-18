import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const MAX_STARS = 5;

/**
 * Renders the rating as five stars plus the numeric value. The stars are
 * decorative: the accessible name carries the real information.
 */
@Component({
  selector: 'app-star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="stars" aria-hidden="true">
      @for (star of stars(); track $index) {
        <span class="star" [class.star--on]="star">★</span>
      }
    </span>
    <span class="value">{{ rate() | number: '1.1-1' }}</span>
    @if (count() > 0) {
      <span class="count">({{ count() }})</span>
    }
    <span class="visually-hidden">
      Rated {{ rate() | number: '1.1-1' }} out of 5 from {{ count() }} reviews
    </span>
  `,
  styleUrl: './star-rating.scss',
  imports: [DecimalPipe],
})
export class StarRatingComponent {
  readonly rate = input.required<number>();
  readonly count = input(0);

  protected readonly stars = computed(() => {
    const filled = Math.round(this.rate());
    return Array.from({ length: MAX_STARS }, (_, index) => index < filled);
  });
}
