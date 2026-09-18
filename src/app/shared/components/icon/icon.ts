import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type IconName =
  | 'cart'
  | 'search'
  | 'sun'
  | 'moon'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'arrow-left'
  | 'check'
  | 'close'
  | 'alert'
  | 'box'
  | 'lock';

/**
 * Icons are rendered from a vetted path table rather than injected markup:
 * nothing user- or API-supplied can reach the DOM through this component.
 */
const ICON_PATHS: Readonly<Record<IconName, readonly string[]>> = {
  cart: [
    'M2.5 3h2l2.2 10.1a2 2 0 0 0 2 1.6h7.1a2 2 0 0 0 2-1.5L19.5 6H6',
    'M9 19.5h.01',
    'M17 19.5h.01',
  ],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4.2-4.2'],
  sun: [
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
    'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ],
  moon: ['M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5Z'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  trash: [
    'M4 7h16',
    'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
  ],
  'arrow-left': ['M19 12H5', 'm11 6-6 6 6 6'],
  check: ['m4 12.5 5 5 11-11'],
  close: ['m6 6 12 12', 'm18 6-12 12'],
  alert: ['M12 8v5', 'M12 17h.01', 'M12 3 2 20h20L12 3Z'],
  box: ['M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z', 'M3 7.5 12 12l9-4.5', 'M12 12v9'],
  lock: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 0 1 6 0v3'],
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (path of paths(); track path) {
        <path [attr.d]="path" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: none;
      }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(18);

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
}
