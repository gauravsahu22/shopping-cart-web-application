import { Product } from '../models/product.model';

/**
 * Runtime validation for data coming from the public Fake Store API.
 *
 * The API is untrusted input: responses can change shape, return nulls, or in a
 * compromised-CDN scenario return hostile values. Everything that reaches the
 * store passes through here first, so the rest of the app can rely on `Product`
 * being accurate rather than merely asserted by a cast.
 */

const MAX_TEXT_LENGTH = 2_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSafeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_TEXT_LENGTH);
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Only http(s) image URLs are accepted. This blocks `javascript:` and `data:`
 * URLs that could otherwise be bound into an `img[src]`.
 */
function toSafeImageUrl(value: unknown): string | null {
  const text = toSafeText(value);
  if (text === null) {
    return null;
  }
  try {
    const url = new URL(text, 'https://fakestoreapi.com');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Returns a validated `Product`, or `null` when the record cannot be trusted. */
export function parseProduct(raw: unknown): Product | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = toFiniteNumber(raw['id']);
  const title = toSafeText(raw['title']);
  const price = toFiniteNumber(raw['price']);
  const category = toSafeText(raw['category']);
  const image = toSafeImageUrl(raw['image']);

  if (id === null || id < 0 || title === null || price === null || price < 0 || category === null) {
    return null;
  }

  const ratingRaw = isRecord(raw['rating']) ? raw['rating'] : {};
  const rate = toFiniteNumber(ratingRaw['rate']) ?? 0;
  const count = toFiniteNumber(ratingRaw['count']) ?? 0;

  return {
    id,
    title,
    price,
    description: toSafeText(raw['description']) ?? '',
    category,
    // A missing/unsafe image is not fatal: the card renders its fallback state.
    image: image ?? '',
    rating: {
      rate: Math.min(Math.max(rate, 0), 5),
      count: Math.max(Math.trunc(count), 0),
    },
  };
}

/** Parses a product collection, silently discarding entries that fail validation. */
export function parseProducts(raw: unknown): Product[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const products: Product[] = [];
  const seen = new Set<number>();
  for (const entry of raw) {
    const product = parseProduct(entry);
    if (product !== null && !seen.has(product.id)) {
      seen.add(product.id);
      products.push(product);
    }
  }
  return products;
}
