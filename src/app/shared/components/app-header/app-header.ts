import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { ThemeService } from '../../../core/services/theme.service';
import { selectCartTotalQuantity } from '../../../features/cart/store/cart.selectors';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
})
export class AppHeaderComponent {
  private readonly store = inject(Store);
  private readonly themeService = inject(ThemeService);

  /**
   * A signal rather than an `async` pipe: the header is always on screen, so
   * there is no subscription lifecycle to manage and the count updates with a
   * targeted re-render instead of an app-wide change-detection pass.
   */
  protected readonly cartQuantity = this.store.selectSignal(selectCartTotalQuantity);
  protected readonly theme = this.themeService.theme;

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
