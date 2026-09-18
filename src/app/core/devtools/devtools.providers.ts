import { EnvironmentProviders } from '@angular/core';
import { provideStoreDevtools } from '@ngrx/store-devtools';

/**
 * Development-only store instrumentation.
 *
 * A runtime `isDevMode()` check is not enough: the import itself keeps the whole
 * `@ngrx/store-devtools` package in the production `main` chunk. The production
 * build swaps this file for `devtools.providers.prod.ts` via `fileReplacements`,
 * so the package is never reachable and the bundler drops it entirely.
 * See docs/performance-notes.md.
 */
export const devtoolsProviders: EnvironmentProviders[] = [
  provideStoreDevtools({ maxAge: 25, connectInZone: false }),
];
