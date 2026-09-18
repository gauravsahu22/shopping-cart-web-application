import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Subject, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCartItem } from '../../../../testing/fixtures';
import { CartActions } from '../../cart/store/cart.actions';
import { CustomerDetails, Order, createOrderReference } from '../models/order.model';
import { CheckoutActions } from './checkout.actions';
import { CheckoutEffects } from './checkout.effects';
import { checkoutReducer, initialCheckoutState } from './checkout.reducer';

const customer: CustomerDetails = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  address: '12 Analytical Way',
  city: 'London',
  postcode: 'EC1A 1BB',
};

const order: Order = {
  reference: 'KBO-ABCD-EFGH',
  placedAt: '2026-01-01T00:00:00.000Z',
  items: [makeCartItem({ quantity: 2 })],
  total: 219.9,
  customerName: customer.fullName,
  email: customer.email,
};

describe('createOrderReference', () => {
  it('produces a human-readable, grouped reference', () => {
    expect(createOrderReference()).toMatch(/^KBO-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('does not repeat itself across a batch', () => {
    const references = new Set(Array.from({ length: 200 }, () => createOrderReference()));
    expect(references.size).toBe(200);
  });
});

describe('checkoutReducer', () => {
  it('marks the order as submitting', () => {
    const state = checkoutReducer(
      initialCheckoutState,
      CheckoutActions.orderSubmitted({ customer, items: order.items, total: order.total }),
    );
    expect(state.submitting).toBe(true);
  });

  it('stores the placed order and stops submitting', () => {
    const state = checkoutReducer(initialCheckoutState, CheckoutActions.orderPlaced({ order }));
    expect(state).toEqual({ lastOrder: order, submitting: false });
  });

  it('forgets the order when the confirmation is dismissed', () => {
    const placed = checkoutReducer(initialCheckoutState, CheckoutActions.orderPlaced({ order }));
    expect(checkoutReducer(placed, CheckoutActions.confirmationDismissed())).toEqual(
      initialCheckoutState,
    );
  });
});

describe('CheckoutEffects', () => {
  let actions$: Subject<Action>;
  let effects: CheckoutEffects;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    actions$ = new Subject();
    navigate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        CheckoutEffects,
        provideMockActions(() => actions$),
        { provide: Router, useValue: { navigate } },
      ],
    });
    effects = TestBed.inject(CheckoutEffects);
  });

  afterEach(() => vi.useRealTimers());

  it('turns a submission into a placed order carrying the basket', async () => {
    const result = firstValueFrom(effects.placeOrder$);
    actions$.next(
      CheckoutActions.orderSubmitted({ customer, items: order.items, total: order.total }),
    );
    await vi.advanceTimersByTimeAsync(1_000);

    const action = await result;
    expect(action.type).toBe(CheckoutActions.orderPlaced.type);
    expect(action.order).toMatchObject({
      items: order.items,
      total: order.total,
      customerName: 'Ada Lovelace',
      email: 'ada@example.com',
    });
    expect(action.order.reference).toMatch(/^KBO-/);
  });

  it('empties the cart only once the order exists', async () => {
    const result = firstValueFrom(effects.clearCart$);
    actions$.next(CheckoutActions.orderPlaced({ order }));
    expect(await result).toEqual(CartActions.clearCart());
  });

  it('navigates to the confirmation screen', () => {
    const subscription = effects.navigateToConfirmation$.subscribe();
    actions$.next(CheckoutActions.orderPlaced({ order }));
    subscription.unsubscribe();

    expect(navigate).toHaveBeenCalledWith(['/order-completed']);
  });
});
