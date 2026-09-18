import { CartItem } from '../../cart/models/cart-item.model';

export interface CustomerDetails {
  readonly fullName: string;
  readonly email: string;
  readonly address: string;
  readonly city: string;
  readonly postcode: string;
}

export interface Order {
  readonly reference: string;
  readonly placedAt: string;
  readonly items: readonly CartItem[];
  readonly total: number;
  readonly customerName: string;
  /** Kept so the confirmation can say where it was sent; nothing else uses it. */
  readonly email: string;
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERENCE_LENGTH = 8;

/**
 * Client-side order reference.
 *
 * There is no order backend in this assignment, so the reference is generated
 * here purely so the confirmation screen reads like a real one. A production
 * system must mint this server-side — a client-generated id cannot be
 * guaranteed unique and must never be trusted as an identifier.
 */
export function createOrderReference(): string {
  const bytes = new Uint8Array(REFERENCE_LENGTH);
  crypto.getRandomValues(bytes);
  const body = Array.from(
    bytes,
    (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
  ).join('');
  return `KBO-${body.slice(0, 4)}-${body.slice(4)}`;
}
