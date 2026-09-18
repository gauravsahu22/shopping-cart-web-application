import { describe, expect, it } from 'vitest';
import { parseProduct, parseProducts } from './product.parser';

const validRaw = {
  id: 7,
  title: 'Solid Gold Petite Micropave',
  price: 168,
  description: 'Satisfaction guaranteed.',
  category: 'jewelery',
  image: 'https://fakestoreapi.com/img/gold.jpg',
  rating: { rate: 3.9, count: 70 },
};

describe('parseProduct', () => {
  it('accepts a well-formed product', () => {
    expect(parseProduct(validRaw)).toEqual({
      id: 7,
      title: 'Solid Gold Petite Micropave',
      price: 168,
      description: 'Satisfaction guaranteed.',
      category: 'jewelery',
      image: 'https://fakestoreapi.com/img/gold.jpg',
      rating: { rate: 3.9, count: 70 },
    });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'product'],
    ['a missing id', { ...validRaw, id: undefined }],
    ['a non-numeric price', { ...validRaw, price: '168' }],
    ['a negative price', { ...validRaw, price: -1 }],
    ['an empty title', { ...validRaw, title: '   ' }],
    ['a missing category', { ...validRaw, category: null }],
  ])('rejects %s', (_label, raw) => {
    expect(parseProduct(raw)).toBeNull();
  });

  it('drops an image URL with an unsafe scheme', () => {
    const product = parseProduct({ ...validRaw, image: 'javascript:alert(1)' });
    expect(product?.image).toBe('');
  });

  it('defaults a missing rating rather than failing', () => {
    const product = parseProduct({ ...validRaw, rating: undefined });
    expect(product?.rating).toEqual({ rate: 0, count: 0 });
  });

  it('clamps an out-of-range rating into 0–5', () => {
    expect(parseProduct({ ...validRaw, rating: { rate: 9, count: 3.7 } })?.rating).toEqual({
      rate: 5,
      count: 3,
    });
  });
});

describe('parseProducts', () => {
  it('returns an empty list when the payload is not an array', () => {
    expect(parseProducts({ products: [validRaw] })).toEqual([]);
  });

  it('keeps valid entries and discards unusable ones', () => {
    const parsed = parseProducts([validRaw, { id: 'nope' }, null, { ...validRaw, id: 8 }]);
    expect(parsed.map((product) => product.id)).toEqual([7, 8]);
  });

  it('discards duplicate ids so downstream lookups stay unambiguous', () => {
    const parsed = parseProducts([validRaw, { ...validRaw, title: 'Impostor' }]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Solid Gold Petite Micropave');
  });
});
