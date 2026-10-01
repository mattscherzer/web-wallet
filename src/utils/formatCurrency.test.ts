import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCurrency, formatSignedCurrency } from './formatCurrency';

const NBSP = ' ';

describe('formatCurrency', () => {
  it('formats euros with two decimals in English', () => {
    expect(formatCurrency(1210.3, 'en')).toBe('€1,210.30');
    expect(formatCurrency(0, 'en')).toBe('€0.00');
  });

  it('formats euros in the German style', () => {
    expect(formatCurrency(1210.3, 'de')).toBe(`1.210,30${NBSP}€`);
  });

  it('prefixes only negative amounts with a true minus', () => {
    expect(formatCurrency(-12, 'en')).toBe('−€12.00');
    expect(formatCurrency(-12, 'de')).toBe(`−12,00${NBSP}€`);
    expect(formatCurrency(12, 'en')).not.toMatch(/[+−-]/);
  });

  it('never shows a signed zero', () => {
    expect(formatCurrency(-0, 'en')).toBe('€0.00');
    expect(formatCurrency(-0.004, 'en')).toBe('€0.00');
  });

  it('treats non-finite amounts as zero', () => {
    expect(formatCurrency(NaN, 'en')).toBe('€0.00');
    expect(formatCurrency(Infinity, 'en')).toBe('€0.00');
  });

  it('falls back to English for a malformed locale', () => {
    expect(formatCurrency(1.5, 'not a locale!!')).toBe('€1.50');
  });

  describe('device locale', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('uses navigator.language when no locale is given', () => {
      vi.stubGlobal('navigator', { language: 'de-DE' });
      expect(formatCurrency(1210.3)).toBe(`1.210,30${NBSP}€`);
    });

    it('falls back to English when navigator is unavailable', () => {
      vi.stubGlobal('navigator', undefined);
      expect(formatCurrency(1210.3)).toBe('€1,210.30');
    });

    it('falls back to English when navigator.language is empty', () => {
      vi.stubGlobal('navigator', { language: '' });
      expect(formatCurrency(1210.3)).toBe('€1,210.30');
    });
  });
});

describe('formatSignedCurrency', () => {
  it('adds + for inflows', () => {
    expect(formatSignedCurrency(145.5, 'inflow', 'en')).toBe('+€145.50');
    expect(formatSignedCurrency(145.5, 'inflow', 'de')).toBe(`+145,50${NBSP}€`);
  });

  it('adds a true minus for outflows', () => {
    expect(formatSignedCurrency(60, 'outflow', 'en')).toBe('−€60.00');
    expect(formatSignedCurrency(60, 'outflow', 'de')).toBe(`−60,00${NBSP}€`);
  });

  it('leaves transfers unsigned', () => {
    expect(formatSignedCurrency(150, 'transfer', 'en')).toBe('€150.00');
  });

  it('derives the sign from the type, not from the amount', () => {
    expect(formatSignedCurrency(60, 'outflow', 'en')).toBe('−€60.00');
    expect(formatSignedCurrency(0, 'inflow', 'en')).toBe('€0.00');
    expect(formatSignedCurrency(0.004, 'outflow', 'en')).toBe('€0.00');
  });
});
