import { InjectionToken } from '@angular/core';

/**
 * Injected rather than imported so tests (and a future environment-specific
 * build) can swap the endpoint without touching the service.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'https://fakestoreapi.com',
});
