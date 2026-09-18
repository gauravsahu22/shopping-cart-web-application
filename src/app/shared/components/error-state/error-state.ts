import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';
import { AppError } from '../../../core/models/app-error.model';

/**
 * Standard failure presentation: a safe message plus a way out. The `role`
 * ensures assistive technology announces the failure when it replaces content.
 */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="error" role="alert">
      <span class="error__icon">
        <app-icon name="alert" [size]="24" />
      </span>
      <h2 class="error__title">{{ heading() }}</h2>
      <p class="error__body">{{ error().message }}</p>
      @if (showRetry()) {
        <button type="button" class="btn btn--primary" (click)="retry.emit()">Try again</button>
      }
    </div>
  `,
  styleUrl: './error-state.scss',
})
export class ErrorStateComponent {
  readonly error = input.required<AppError>();
  readonly heading = input('We hit a snag');
  readonly showRetry = input(true);
  readonly retry = output<void>();
}
