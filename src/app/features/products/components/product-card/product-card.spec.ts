import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeProduct } from '../../../../../testing/fixtures';
import { ProductCardComponent } from './product-card';

/**
 * These assertions are deliberately behavioural: they check what a shopper can
 * see and click, so the test still fails if the feature breaks but the internal
 * structure is refactored.
 */
describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  let element: HTMLElement;

  async function render(quantityInCart = 0) {
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput(
      'product',
      makeProduct({ title: 'Cotton Jacket', price: 55.99, rating: { rate: 4.7, count: 500 } }),
    );
    fixture.componentRef.setInput('quantityInCart', quantityInCart);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('shows the product name, category, price and rating', async () => {
    await render();

    expect(element.textContent).toContain('Cotton Jacket');
    expect(element.textContent).toContain("men's clothing");
    expect(element.textContent).toContain('$55.99');
    expect(element.textContent).toContain('4.7');
    expect(element.textContent).toContain('(500)');
  });

  it('offers an Add to cart button when the product is not in the cart', async () => {
    await render(0);

    const button = element.querySelector<HTMLButtonElement>('.btn--primary');
    expect(button?.textContent).toContain('Add to cart');
    expect(element.querySelector('app-quantity-stepper')).toBeNull();
  });

  it('emits the product when Add to cart is pressed', async () => {
    await render(0);

    let emitted: number | null = null;
    fixture.componentInstance.add.subscribe((product) => (emitted = product.id));
    element.querySelector<HTMLButtonElement>('.btn--primary')?.click();

    expect(emitted).toBe(1);
  });

  it('swaps the button for a quantity control once the product is in the cart', async () => {
    await render(3);

    expect(element.querySelector('app-quantity-stepper')).not.toBeNull();
    expect(element.textContent).toContain('In cart');
    expect(element.querySelector('.btn--primary')).toBeNull();
  });

  it('marks a highly rated product', async () => {
    await render();
    expect(element.textContent).toContain('Top rated');
  });

  it('does not mark an average product', async () => {
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', makeProduct({ rating: { rate: 3.1, count: 10 } }));
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Top rated');
  });

  it('gives the product image a meaningful alt text', async () => {
    await render();
    expect(element.querySelector('img')?.getAttribute('alt')).toBe('Cotton Jacket');
  });
});
