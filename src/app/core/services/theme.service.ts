import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'kibo.theme.v1';

/** Matches `--bg` for each theme in `_tokens.scss`. */
const BROWSER_UI_COLOUR: Record<Theme, string> = {
  light: '#faf3ec',
  dark: '#1d1020',
};

/**
 * Theme is local UI state with no cross-feature business meaning, so it lives in
 * a signal-based service rather than in the NgRx store.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);
  private readonly document = inject(DOCUMENT);

  readonly theme = signal<Theme>(this.initialTheme());

  constructor() {
    effect(() => {
      const theme = this.theme();
      this.document.documentElement.setAttribute('data-theme', theme);
      this.syncBrowserChrome(theme);
      this.storage.write(THEME_STORAGE_KEY, theme);
    });
  }

  toggle(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  /**
   * The theme is an explicit in-app choice, so the first visit always starts on
   * light. Following `prefers-color-scheme` here would make the toggle look
   * broken on a phone in system dark mode: the user picks light, reloads, and
   * lands back on dark.
   */
  private initialTheme(): Theme {
    const stored = this.storage.read(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'light';
  }

  /**
   * `only light` / `only dark` (rather than plain `light` / `dark`) opts the
   * page out of Chrome for Android's Auto Dark Theme, which otherwise
   * force-darkens the rendered result whenever the phone is in dark mode —
   * making every theme look dark no matter what the toggle says.
   */
  private syncBrowserChrome(theme: Theme): void {
    this.setMeta('color-scheme', `only ${theme}`);
    this.setMeta('theme-color', BROWSER_UI_COLOUR[theme]);
  }

  private setMeta(name: string, content: string): void {
    const meta = this.document.head?.querySelector(`meta[name="${name}"]`);
    meta?.setAttribute('content', content);
  }
}
