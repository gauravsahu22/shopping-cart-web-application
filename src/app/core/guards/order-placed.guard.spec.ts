import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Store, provideState, provideStore } from '@ngrx/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeCartItem } from '../../../testing/fixtures';
import { CheckoutActions } from '../../features/checkout/store/checkout.actions';
import { checkoutFeature } from '../../features/checkout/store/checkout.reducer';
import { orderPlacedGuard } from './order-placed.guard';

describe('orderPlacedGuard', () => {
  let store: Store;

  function run(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      orderPlacedGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideStore(), provideState(checkoutFeature)],
    });
    store = TestBed.inject(Store);
  });

  it('sends a direct visit back to the catalogue', () => {
    const result = run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/');
  });

  it('allows the confirmation through once an order has been placed', () => {
    store.dispatch(
      CheckoutActions.orderPlaced({
        order: {
          reference: 'KBO-ABCD-EFGH',
          placedAt: new Date().toISOString(),
          items: [makeCartItem()],
          total: 109.95,
          customerName: 'Ada Lovelace',
          email: 'ada@example.com',
        },
      }),
    );

    expect(run()).toBe(true);
  });
});
