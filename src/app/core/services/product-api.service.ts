import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Product } from '../models/product.model';
import { parseProduct, parseProducts } from '../utils/product.parser';
import { API_BASE_URL } from '../tokens/api-base-url.token';

/**
 * The only place in the application that knows about the Fake Store API.
 * Components and effects depend on `Product`, never on the wire format.
 */
@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getProducts(): Observable<Product[]> {
    return this.http.get<unknown>(`${this.baseUrl}/products`).pipe(map(parseProducts));
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<unknown>(`${this.baseUrl}/products/${id}`).pipe(
      map((raw) => parseProduct(raw)),
      map((product) => {
        if (product === null) {
          throw new Error('Unusable product payload');
        }
        return product;
      }),
    );
  }
}
