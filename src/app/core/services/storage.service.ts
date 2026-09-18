import { Injectable } from '@angular/core';

/**
 * Thin wrapper over `localStorage`.
 *
 * Every access is guarded: storage throws in Safari private mode, when the
 * origin has site data blocked, and inside some embedded webviews. A store
 * should never fail to initialise because persistence is unavailable.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Quota exceeded or storage disabled — persistence is best-effort. */
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Ignored for the same reason as `write`. */
    }
  }
}
