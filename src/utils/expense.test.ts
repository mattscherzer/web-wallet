import { describe, expect, it } from 'vitest';
import { wouldOverdraw } from './expense';

describe('wouldOverdraw', () => {
  it('is false when the balance covers the amount exactly', () => {
    expect(wouldOverdraw(10, 10)).toBe(false);
  });

  it('is true when the amount exceeds the balance', () => {
    expect(wouldOverdraw(10, 10.01)).toBe(true);
  });

  it('is true when the balance is already negative', () => {
    expect(wouldOverdraw(-5, 1)).toBe(true);
  });

  it('ignores floating point noise', () => {
    expect(wouldOverdraw(0.3, 0.1 + 0.2)).toBe(false);
  });

  it('does not warn when the balance is unknown (not loaded or fetch failed)', () => {
    expect(wouldOverdraw(null, 100)).toBe(false);
  });

  it('is false for an empty or invalid amount', () => {
    expect(wouldOverdraw(0, 0)).toBe(false);
    expect(wouldOverdraw(0, NaN)).toBe(false);
  });
});
