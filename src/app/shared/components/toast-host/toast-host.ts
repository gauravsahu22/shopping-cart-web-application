import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon';

/**
 * Live region for transient confirmations. `polite` so it never interrupts a
 * screen-reader user mid-sentence.
 */
@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div class="toast" [class.toast--danger]="toast.tone === 'danger'">
          <app-icon [name]="toast.tone === 'danger' ? 'alert' : 'check'" [size]="16" />
          <p class="toast__message">{{ toast.message }}</p>
          <button type="button" class="toast__close" (click)="dismiss(toast.id)">
            <app-icon name="close" [size]="14" />
            <span class="visually-hidden">Dismiss notification</span>
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './toast-host.scss',
})
export class ToastHostComponent {
  private readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
