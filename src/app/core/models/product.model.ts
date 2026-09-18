/** Canonical product shape used across the application. */
export interface Product {
  readonly id: number;
  readonly title: string;
  readonly price: number;
  readonly description: string;
  readonly category: string;
  readonly image: string;
  readonly rating: ProductRating;
}

export interface ProductRating {
  readonly rate: number;
  readonly count: number;
}

/** Sort options offered by the product listing. */
export type ProductSort =
  'featured' | 'price-asc' | 'price-desc' | 'rating-desc' | 'name-asc' | 'name-desc';

export const PRODUCT_SORT_OPTIONS: readonly { value: ProductSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating-desc', label: 'Rating: high to low' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
];

/** `null` category means "All". */
export type CategoryFilter = string | null;

/**
 * The query a catalogue page is built from. It is deliberately shaped like a
 * server-side request (see docs/adr-002-pagination.md) so the presentation layer
 * does not change when pagination moves to the backend.
 */
export interface ProductQuery {
  readonly search: string;
  readonly category: CategoryFilter;
  readonly sort: ProductSort;
  readonly pageSize: number;
  /** How many pages of `pageSize` are currently revealed ("load more"). */
  readonly pagesLoaded: number;
}

/** A resolved slice of the catalogue plus the metadata the UI needs. */
export interface ProductPage {
  readonly items: readonly Product[];
  readonly shown: number;
  readonly total: number;
  readonly hasMore: boolean;
  readonly remaining: number;
}
