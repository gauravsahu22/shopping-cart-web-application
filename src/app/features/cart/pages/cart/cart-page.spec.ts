import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideState, provideStore } from '@ngrx/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeProduct } from '../../../../../testing/fixtures';
import { CartActions } from '../../store/cart.actions';
import { cartFeature } from '../../store/cart.reducer';
import { CartPage } from './cart-page';

describe('CartPage', () => {
  let fixture: ComponentFixture<CartPage>;
  let element: HTMLElement;
  let store: Store;

  const backpack = makeProduct({ id: 1, title: 'Backpack', price: 109.95 });
  const jacket = makeProduct({ id: 2, title: 'Cotton Jacket', price: 55.99 });

  async function render() {
    fixture = TestBed.createComponent(CartPage);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  function lines(): HTMLElement[] {
    return [...element.querySelectorAll('app-cart-line')] as HTMLElement[];
  }

  function total(): string {
    return element.querySelector('.summary-row--total dd')?.textContent?.trim() ?? '';
  }

  function clickIn(line: ParentNode, name: RegExp): void {
    const button = [...line.querySelectorAll('button')].find((candidate) =>
      name.test(candidate.textContent ?? ''),
    );
    (button as HTMLButtonElement | undefined)?.click();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideStore(), provideState(cartFeature)],
    });
    store = TestBed.inject(Store);
  });

  it('invites the shopper to browse when the cart is empty', async () => {
    await render();

    expect(element.textContent).toContain('Your cart is empty');
    expect(lines()).toHaveLength(0);
    expect(element.querySelector('.summary-row--total')).toBeNull();
  });

  it('lists each product once with its quantity and line total', async () => {
    store.dispatch(CartActions.addItem({ product: backpack, quantity: 2 }));
    store.dispatch(CartActions.addItem({ product: jacket, quantity: 1 }));
    await render();

    expect(lines()).toHaveLength(2);
    expect(lines()[0].textContent).toContain('Backpack');
    expect(lines()[0].textContent).toContain('$219.90');
    expect(element.textContent).toContain('2 products');
    expect(element.textContent).toContain('3 items');
  });

  it('shows a total that matches the sum of the lines', async () => {
    store.dispatch(CartActions.addItem({ product: backpack, quantity: 2 }));
    store.dispatch(CartActions.addItem({ product: jacket, quantity: 1 }));
    await render();

    expect(total()).toBe('$275.89');
  });

  it('updates the total when a quantity is increased', async () => {
    store.dispatch(CartActions.addItem({ product: jacket, quantity: 1 }));
    await render();

    clickIn(lines()[0], /Increase quantity/);
    await fixture.whenStable();

    expect(total()).toBe('$111.98');
  });

  it('updates the total when a quantity is decreased', async () => {
    store.dispatch(CartActions.addItem({ product: jacket, quantity: 3 }));
    await render();

    clickIn(lines()[0], /Decrease quantity/);
    await fixture.whenStable();

    expect(total()).toBe('$111.98');
  });

  it('removes a line and falls back to the empty state', async () => {
    store.dispatch(CartActions.addItem({ product: jacket, quantity: 1 }));
    await render();

    clickIn(lines()[0], /Remove/);
    await fixture.whenStable();

    expect(lines()).toHaveLength(0);
    expect(element.textContent).toContain('Your cart is empty');
  });

  it('offers a route to checkout only when there is something to buy', async () => {
    await render();
    expect(element.querySelector('a[href="/checkout"]')).toBeNull();

    store.dispatch(CartActions.addItem({ product: jacket, quantity: 1 }));
    await fixture.whenStable();
    expect(element.querySelector('a[href="/checkout"]')).not.toBeNull();
  });

  it('always offers a way back to the catalogue', async () => {
    await render();
    expect(element.querySelector('a[href="/"]')).not.toBeNull();
  });
});
