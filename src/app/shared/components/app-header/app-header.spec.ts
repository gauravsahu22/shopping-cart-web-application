import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideState, provideStore } from '@ngrx/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeProduct } from '../../../../testing/fixtures';
import { CartActions } from '../../../features/cart/store/cart.actions';
import { cartFeature } from '../../../features/cart/store/cart.reducer';
import { AppHeaderComponent } from './app-header';

describe('AppHeaderComponent', () => {
  let fixture: ComponentFixture<AppHeaderComponent>;
  let element: HTMLElement;
  let store: Store;

  function count(): string {
    return element.querySelector('.cart-button__count')?.textContent?.trim() ?? '';
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideStore(), provideState(cartFeature)],
    });
    store = TestBed.inject(Store);
    fixture = TestBed.createComponent(AppHeaderComponent);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  it('starts at zero', () => {
    expect(count()).toBe('0');
  });

  it('reflects added items immediately', async () => {
    store.dispatch(CartActions.addItem({ product: makeProduct(), quantity: 2 }));
    await fixture.whenStable();
    expect(count()).toBe('2');
  });

  it('counts units across products, not lines', async () => {
    store.dispatch(CartActions.addItem({ product: makeProduct({ id: 1 }), quantity: 2 }));
    store.dispatch(CartActions.addItem({ product: makeProduct({ id: 2 }), quantity: 3 }));
    await fixture.whenStable();
    expect(count()).toBe('5');
  });

  it('goes back to zero when the cart is cleared', async () => {
    store.dispatch(CartActions.addItem({ product: makeProduct(), quantity: 2 }));
    await fixture.whenStable();
    store.dispatch(CartActions.clearCart());
    await fixture.whenStable();
    expect(count()).toBe('0');
  });

  it('announces the basket contents to assistive technology', async () => {
    store.dispatch(CartActions.addItem({ product: makeProduct(), quantity: 1 }));
    await fixture.whenStable();

    expect(element.querySelector('.cart-button .visually-hidden')?.textContent).toContain(
      '1 item in your cart',
    );
  });

  it('links the logo home and the basket to the cart', () => {
    expect(element.querySelector('a.brand')?.getAttribute('href')).toBe('/');
    expect(element.querySelector('a.cart-button')?.getAttribute('href')).toBe('/cart');
  });

  it('exposes an accessible name for the theme toggle', () => {
    const toggle = element.querySelector('.icon-button');
    expect(toggle?.getAttribute('aria-label')).toMatch(/Switch to (light|dark) theme/);
  });

  it('switches the theme on the document when toggled', async () => {
    const before = document.documentElement.getAttribute('data-theme');
    element.querySelector<HTMLButtonElement>('.icon-button')?.click();
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).not.toBe(before);
  });
});
