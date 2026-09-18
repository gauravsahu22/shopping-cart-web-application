import { describe, expect, it } from 'vitest';
import { fromMinorUnits, lineTotal, sumLineTotals, toMinorUnits } from './money';

describe('money', () => {
  it('converts to and from minor units', () => {
    expect(toMinorUnits(109.95)).toBe(10995);
    expect(fromMinorUnits(10995)).toBe(109.95);
  });

  it('computes a line total without float drift', () => {
    expect(lineTotal(0.1, 3)).toBe(0.3);
    expect(lineTotal(19.99, 7)).toBe(139.93);
  });

  it('sums lines exactly', () => {
    // 0.1 + 0.2 in floating point is 0.30000000000000004.
    expect(
      sumLineTotals([
        { price: 0.1, quantity: 1 },
        { price: 0.2, quantity: 1 },
      ]),
    ).toBe(0.3);
  });

  it('sums a realistic basket', () => {
    expect(
      sumLineTotals([
        { price: 109.95, quantity: 2 },
        { price: 55.99, quantity: 1 },
      ]),
    ).toBe(275.89);
  });

  it('treats an empty basket as zero', () => {
    expect(sumLineTotals([])).toBe(0);
  });
});
