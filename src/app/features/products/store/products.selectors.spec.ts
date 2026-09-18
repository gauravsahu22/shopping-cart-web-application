import { describe, expect, it } from 'vitest';
import { catalogue } from '../../../../testing/fixtures';
import { ProductQuery, ProductSort } from '../../../core/models/product.model';
import { initialQuery } from './products.reducer';
import {
  selectCategoryOptions,
  selectFilteredProducts,
  selectHasActiveFilters,
  selectIsCatalogueEmpty,
  selectProductPage,
  selectProductsLoading,
} from './products.selectors';

function query(overrides: Partial<ProductQuery> = {}): ProductQuery {
  return { ...initialQuery, ...overrides };
}

function titlesFor(overrides: Partial<ProductQuery>): string[] {
  return selectFilteredProducts.projector(catalogue, query(overrides)).map((p) => p.title);
}

describe('selectFilteredProducts', () => {
  it('returns the whole catalogue by default', () => {
    expect(titlesFor({})).toHaveLength(catalogue.length);
  });

  it('filters by category', () => {
    expect(titlesFor({ category: 'jewelery' })).toEqual(['Gold Bracelet', 'Anchor Ring']);
  });

  it('searches product names case-insensitively', () => {
    expect(titlesFor({ search: 'JACKET' })).toEqual(['Cotton Jacket']);
  });

  it('ignores surrounding whitespace in the search term', () => {
    expect(titlesFor({ search: '  ring ' })).toEqual(['Anchor Ring']);
  });

  it('combines a category filter with a search term', () => {
    expect(titlesFor({ category: 'jewelery', search: 'gold' })).toEqual(['Gold Bracelet']);
    expect(titlesFor({ category: "men's clothing", search: 'gold' })).toEqual([]);
  });

  it('returns nothing when the search matches no product', () => {
    expect(titlesFor({ search: 'submarine' })).toEqual([]);
  });

  it.each<[ProductSort, string[]]>([
    ['price-asc', ['Anchor Ring', 'Cotton Jacket', 'Portable SSD', 'Backpack', 'Gold Bracelet']],
    ['price-desc', ['Gold Bracelet', 'Backpack', 'Portable SSD', 'Cotton Jacket', 'Anchor Ring']],
    ['rating-desc', ['Cotton Jacket', 'Gold Bracelet', 'Backpack', 'Anchor Ring', 'Portable SSD']],
    ['name-asc', ['Anchor Ring', 'Backpack', 'Cotton Jacket', 'Gold Bracelet', 'Portable SSD']],
    ['name-desc', ['Portable SSD', 'Gold Bracelet', 'Cotton Jacket', 'Backpack', 'Anchor Ring']],
  ])('sorts by %s', (sort, expected) => {
    expect(titlesFor({ sort })).toEqual(expected);
  });

  it('leaves the API order untouched for the featured sort', () => {
    expect(titlesFor({ sort: 'featured' })).toEqual(catalogue.map((product) => product.title));
  });

  it('does not mutate the source catalogue while sorting', () => {
    const before = catalogue.map((product) => product.id);
    titlesFor({ sort: 'price-desc' });
    expect(catalogue.map((product) => product.id)).toEqual(before);
  });
});

describe('selectProductPage', () => {
  it('returns only the first page and reports what remains', () => {
    const page = selectProductPage.projector(catalogue, query({ pageSize: 2, pagesLoaded: 1 }));
    expect(page.items).toHaveLength(2);
    expect(page).toMatchObject({ shown: 2, total: 5, hasMore: true, remaining: 3 });
  });

  it('reveals another page when one more is requested', () => {
    const page = selectProductPage.projector(catalogue, query({ pageSize: 2, pagesLoaded: 2 }));
    expect(page).toMatchObject({ shown: 4, hasMore: true, remaining: 1 });
  });

  it('never asks for more items than exist', () => {
    const page = selectProductPage.projector(catalogue, query({ pageSize: 2, pagesLoaded: 99 }));
    expect(page).toMatchObject({ shown: 5, hasMore: false, remaining: 0 });
  });

  it('handles an empty result set', () => {
    const page = selectProductPage.projector([], query());
    expect(page).toMatchObject({ shown: 0, total: 0, hasMore: false, remaining: 0 });
  });
});

describe('selectCategoryOptions', () => {
  it('lists every category with its count, All first', () => {
    expect(selectCategoryOptions.projector(catalogue)).toEqual([
      { value: null, label: 'All', count: 5 },
      { value: 'electronics', label: 'Electronics', count: 1 },
      { value: 'jewelery', label: 'Jewelery', count: 1 + 1 },
      { value: "men's clothing", label: "Men's Clothing", count: 2 },
    ]);
  });

  it('title-cases without breaking on an apostrophe', () => {
    const labels = selectCategoryOptions.projector(catalogue).map((option) => option.label);
    expect(labels).toContain("Men's Clothing");
    expect(labels).not.toContain("Men'S Clothing");
  });
});

describe('catalogue status selectors', () => {
  it('treats idle and loading alike for the loading indicator', () => {
    expect(selectProductsLoading.projector('idle')).toBe(true);
    expect(selectProductsLoading.projector('loading')).toBe(true);
    expect(selectProductsLoading.projector('loaded')).toBe(false);
  });

  it('only reports an empty catalogue once loading has finished', () => {
    expect(selectIsCatalogueEmpty.projector([], 'loading')).toBe(false);
    expect(selectIsCatalogueEmpty.projector([], 'loaded')).toBe(true);
  });

  it('knows when filters are active', () => {
    expect(selectHasActiveFilters.projector(query())).toBe(false);
    expect(selectHasActiveFilters.projector(query({ search: 'ring' }))).toBe(true);
    expect(selectHasActiveFilters.projector(query({ category: 'jewelery' }))).toBe(true);
    expect(selectHasActiveFilters.projector(query({ sort: 'price-asc' }))).toBe(true);
  });
});
