import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { Store, provideState, provideStore } from '@ngrx/store';
import { NEVER, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogue } from '../../../../../testing/fixtures';
import { ProductApiService } from '../../../../core/services/product-api.service';
import { cartFeature } from '../../../cart/store/cart.reducer';
import { selectCartTotalQuantity } from '../../../cart/store/cart.selectors';
import { ProductsEffects } from '../../store/products.effects';
import { productsFeature } from '../../store/products.reducer';
import { ProductListPage } from './product-list';

/**
 * Integration test: the real store, the real reducers and the real effects, with
 * only the HTTP boundary replaced. It asserts what the shopper sees, so it would
 * fail if filtering, sorting, paging or add-to-cart stopped working — not merely
 * if their implementation changed.
 */
describe('ProductListPage', () => {
  let fixture: ComponentFixture<ProductListPage>;
  let element: HTMLElement;
  let store: Store;
  let getProducts: ReturnType<typeof vi.fn>;

  async function render() {
    fixture = TestBed.createComponent(ProductListPage);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
    store = TestBed.inject(Store);
  }

  function cards(): HTMLElement[] {
    return [...element.querySelectorAll('app-product-card')] as HTMLElement[];
  }

  function cardTitles(): string[] {
    return cards().map(
      (card) => card.querySelector('.product-card__title')?.textContent?.trim() ?? '',
    );
  }

  function clickButton(name: RegExp, within: ParentNode = element): void {
    const button = [...within.querySelectorAll('button')].find((candidate) =>
      name.test(candidate.textContent ?? ''),
    );
    (button as HTMLButtonElement | undefined)?.click();
  }

  beforeEach(() => {
    getProducts = vi.fn().mockReturnValue(of(catalogue));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore(),
        provideState(productsFeature),
        provideState(cartFeature),
        provideEffects([ProductsEffects]),
        { provide: ProductApiService, useValue: { getProducts, getProduct: vi.fn() } },
      ],
    });
  });

  it('renders the catalogue once it loads', async () => {
    await render();
    expect(cards()).toHaveLength(catalogue.length);
    expect(element.textContent).toContain('Showing');
  });

  it('shows a skeleton, not a blank screen, while the catalogue is in flight', async () => {
    getProducts.mockReturnValue(NEVER);
    await render();

    expect(element.querySelector('app-product-grid-skeleton')).not.toBeNull();
    expect(element.querySelector('app-error-state')).toBeNull();
    expect(element.textContent).toContain('Loading products');
  });

  it('filters by category', async () => {
    await render();
    clickButton(/^\s*Jewelery/);
    await fixture.whenStable();

    expect(cardTitles()).toEqual(['Gold Bracelet', 'Anchor Ring']);
  });

  it('shows an empty state when a search matches nothing', async () => {
    await render();

    const input = element.querySelector<HTMLInputElement>('#product-search');
    input!.value = 'submarine';
    input!.dispatchEvent(new Event('input'));
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(element.querySelector('app-empty-state')).not.toBeNull();
    });

    expect(element.textContent).toContain('No products match your filters');
    expect(cards()).toHaveLength(0);
  });

  it('combines a category filter with a search term, and clears both', async () => {
    await render();

    clickButton(/^\s*Jewelery/);
    const input = element.querySelector<HTMLInputElement>('#product-search');
    input!.value = 'gold';
    input!.dispatchEvent(new Event('input'));

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(cardTitles()).toEqual(['Gold Bracelet']);
    });

    clickButton(/Clear filters/);
    await fixture.whenStable();
    expect(cards()).toHaveLength(catalogue.length);
  });

  it('sorts by price when the shopper chooses that option', async () => {
    await render();

    const select = element.querySelector<HTMLSelectElement>('#product-sort');
    select!.value = 'price-asc';
    select!.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(cardTitles()[0]).toBe('Anchor Ring');
  });

  it('adds a product to the cart and reflects it in the card and the basket count', async () => {
    await render();

    clickButton(/Add to cart/, cards()[0]);
    await fixture.whenStable();

    expect(cards()[0].textContent).toContain('In cart');
    expect(store.selectSignal(selectCartTotalQuantity)()).toBe(1);
  });

  it('keeps one cart line when the same product is added twice', async () => {
    await render();

    clickButton(/Add to cart/, cards()[0]);
    await fixture.whenStable();
    clickButton(/Increase quantity/, cards()[0]);
    await fixture.whenStable();

    expect(store.selectSignal(selectCartTotalQuantity)()).toBe(2);
    expect(store.selectSignal(cartFeature.selectItems)()).toHaveLength(1);
  });

  it('reveals more products on request', async () => {
    getProducts.mockReturnValue(
      of(
        Array.from({ length: 30 }, (_, index) => ({
          ...catalogue[0],
          id: index + 1,
          title: `Product ${index + 1}`,
        })),
      ),
    );
    await render();

    expect(cards()).toHaveLength(12);
    clickButton(/Load more/);
    await fixture.whenStable();
    expect(cards()).toHaveLength(24);

    clickButton(/Show all/);
    await fixture.whenStable();
    expect(cards()).toHaveLength(30);
  });

  it('shows a retryable error when the catalogue cannot be loaded', async () => {
    getProducts.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await render();

    const error = element.querySelector('app-error-state');
    expect(error).not.toBeNull();
    expect(error?.getAttribute('role') ?? error?.querySelector('[role="alert"]')).toBeTruthy();
    expect(element.textContent).toContain('trouble');

    getProducts.mockReturnValue(of(catalogue));
    clickButton(/Try again/);
    await fixture.whenStable();

    expect(element.querySelector('app-error-state')).toBeNull();
    expect(cards()).toHaveLength(catalogue.length);
  });

  it('shows an empty catalogue without an error when the API returns nothing', async () => {
    getProducts.mockReturnValue(of([]));
    await render();

    expect(element.querySelector('app-error-state')).toBeNull();
    expect(element.textContent).toContain('No products match your filters');
  });
});
