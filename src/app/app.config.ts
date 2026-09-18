import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { routes } from './app.routes';
import { devtoolsProviders } from './core/devtools/devtools.providers';
import { retryInterceptor } from './core/interceptors/retry.interceptor';
import { StorageService } from './core/services/storage.service';
import {
  CART_STORAGE_KEY,
  cartPersistenceMetaReducer,
} from './features/cart/store/cart.persistence';
import { cartFeature } from './features/cart/store/cart.reducer';
import { checkoutFeature } from './features/checkout/store/checkout.reducer';
import { CheckoutEffects } from './features/checkout/store/checkout.effects';
import { ProductsEffects } from './features/products/store/products.effects';
import { productsFeature } from './features/products/store/products.reducer';

/**
 * `StorageService` has no dependencies, so the persistence meta-reducer can be
 * built here without an injection context. Tests exercise the meta-reducer
 * directly with in-memory read/write functions.
 */
const cartStorage = new StorageService();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([retryInterceptor])),

    provideStore(),
    // Cart and checkout are registered at bootstrap: the header reads the cart
    // count on every route, and the checkout slice survives the cart being
    // cleared. The products slice is registered with them for simplicity — it
    // is tiny, and the *components* are what lazy-load.
    provideState(productsFeature),
    provideState(cartFeature.name, cartFeature.reducer, {
      metaReducers: [
        cartPersistenceMetaReducer(
          () => cartStorage.read(CART_STORAGE_KEY),
          (value) => cartStorage.write(CART_STORAGE_KEY, value),
        ),
      ],
    }),
    provideState(checkoutFeature),
    provideEffects([ProductsEffects, CheckoutEffects]),

    // Replaced with an empty array in production builds, which is what keeps
    // @ngrx/store-devtools out of the shipped bundle entirely.
    devtoolsProviders,
  ],
};
