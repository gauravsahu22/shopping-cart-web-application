import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { IconComponent } from '../icon/icon';

/**
 * Product imagery comes from a third party at unpredictable sizes and
 * occasionally 404s. This component fixes the aspect ratio (so the grid never
 * shifts once images arrive), keeps `object-fit: contain` so nothing is cropped,
 * and degrades to a labelled placeholder when a file fails to load.
 */
@Component({
  selector: 'app-product-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (failed() || src().length === 0) {
      <span class="fallback" role="img" [attr.aria-label]="alt()">
        <app-icon name="box" [size]="28" />
      </span>
    } @else {
      <img
        [src]="src()"
        [alt]="alt()"
        [attr.loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : 'auto'"
        decoding="async"
        [class.is-loaded]="loaded()"
        (load)="loaded.set(true)"
        (error)="failed.set(true)"
      />
    }
  `,
  styleUrl: './product-image.scss',
  host: { '[style.aspect-ratio]': 'ratio()' },
})
export class ProductImageComponent {
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
  /** Above-the-fold images opt out of lazy loading to protect LCP. */
  readonly priority = input(false);
  readonly aspectRatio = input('1 / 1');

  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly ratio = computed(() => this.aspectRatio());
}
