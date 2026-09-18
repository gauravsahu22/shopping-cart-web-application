import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Product } from '../models/product.model';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { ProductApiService } from './product-api.service';

const BASE = 'https://api.test';

const rawProduct = {
  id: 1,
  title: 'Backpack',
  price: 109.95,
  description: 'Fits laptops',
  category: "men's clothing",
  image: 'https://api.test/img/backpack.jpg',
  rating: { rate: 3.9, count: 120 },
};

describe('ProductApiService', () => {
  let service: ProductApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    service = TestBed.inject(ProductApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getProducts', () => {
    it('returns validated products on success', async () => {
      const promise = firstValue(service.getProducts());
      http.expectOne(`${BASE}/products`).flush([rawProduct]);

      const products = await promise;
      expect(products).toHaveLength(1);
      expect(products[0].title).toBe('Backpack');
    });

    it('returns an empty list for an empty response', async () => {
      const promise = firstValue(service.getProducts());
      http.expectOne(`${BASE}/products`).flush([]);
      await expect(promise).resolves.toEqual([]);
    });

    it('drops entries the API returns in an unexpected shape', async () => {
      const promise = firstValue(service.getProducts());
      http
        .expectOne(`${BASE}/products`)
        .flush([rawProduct, { id: 2 }, null, { ...rawProduct, id: 3, price: 'free' }]);

      const products = await promise;
      expect(products.map((product: Product) => product.id)).toEqual([1]);
    });

    it('returns an empty list when the payload is not an array at all', async () => {
      const promise = firstValue(service.getProducts());
      http.expectOne(`${BASE}/products`).flush({ data: [rawProduct] });
      await expect(promise).resolves.toEqual([]);
    });

    it('propagates transport failures to the caller', async () => {
      const promise = firstValue(service.getProducts());
      http
        .expectOne(`${BASE}/products`)
        .flush('upstream exploded', { status: 500, statusText: 'Server Error' });

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
    });
  });

  describe('getProduct', () => {
    it('returns a single validated product', async () => {
      const promise = firstValue(service.getProduct(1));
      http.expectOne(`${BASE}/products/1`).flush(rawProduct);
      await expect(promise).resolves.toMatchObject({ id: 1, title: 'Backpack' });
    });

    it('fails when the payload cannot be trusted', async () => {
      const promise = firstValue(service.getProduct(1));
      http.expectOne(`${BASE}/products/1`).flush({ id: 1 });
      await expect(promise).rejects.toThrow('Unusable product payload');
    });

    it('fails when the API responds with an empty body', async () => {
      const promise = firstValue(service.getProduct(404));
      http.expectOne(`${BASE}/products/404`).flush(null);
      await expect(promise).rejects.toThrow('Unusable product payload');
    });
  });
});

function firstValue<T>(source: import('rxjs').Observable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    source.subscribe({ next: resolve, error: reject });
  });
}
