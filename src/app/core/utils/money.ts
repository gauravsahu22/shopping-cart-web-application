/**
 * Money helpers.
 *
 * Cart arithmetic is done in integer minor units (cents) and converted back for
 * display. Accumulating `0.1 + 0.2`-style floats across a cart produces totals
 * that are off by fractions of a cent and render as `59.870000000000005`.
 */

const MINOR_UNITS_PER_UNIT = 100;

export function toMinorUnits(amount: number): number {
  return Math.round(amount * MINOR_UNITS_PER_UNIT);
}

export function fromMinorUnits(minor: number): number {
  return minor / MINOR_UNITS_PER_UNIT;
}

/** Sum of `price * quantity` for a set of lines, rounded to whole cents. */
export function sumLineTotals(lines: readonly { price: number; quantity: number }[]): number {
  const minor = lines.reduce((total, line) => total + toMinorUnits(line.price) * line.quantity, 0);
  return fromMinorUnits(minor);
}

export function lineTotal(price: number, quantity: number): number {
  return fromMinorUnits(toMinorUnits(price) * quantity);
}
