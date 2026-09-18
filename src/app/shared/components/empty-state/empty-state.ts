import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="empty">
      <span class="empty__icon">
        <app-icon [name]="icon()" [size]="26" />
      </span>
      <h2 class="empty__title">{{ heading() }}</h2>
      <p class="empty__body">{{ body() }}</p>
      <ng-content />
    </div>
  `,
  styleUrl: './empty-state.scss',
})
export class EmptyStateComponent {
  readonly heading = input.required<string>();
  readonly body = input('');
  readonly icon = input<IconName>('box');
}
