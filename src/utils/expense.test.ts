import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPENSE_ACCOUNT,
  buildExpenseInput,
  wouldOverdraw,
} from './expense';
import { PAYMENT_OPTIONS } from '../components/paymentOptions';

describe('expense account options', () => {
  it('offers cash, paypal and bank, and never the prudent reserve', () => {
    const ids = PAYMENT_OPTIONS.map((o) => o.id);
    expect(ids).toEqual(['cash', 'paypal', 'bank']);
    expect(ids).not.toContain('prudent_reserve');
  });

  it('defaults to cash', () => {
    expect(DEFAULT_EXPENSE_ACCOUNT).toBe('cash');
  });
});

describe('buildExpenseInput', () => {
  const base = {
    amount: '12.50',
    date: '2026-03-01',
    accountId: 'paypal' as const,
    category: 'rent',
    customCategory: '',
    notes: 'March',
  };

  it('books the outflow against the selected account', () => {
    expect(buildExpenseInput(base)).toMatchObject({
      type: 'outflow',
      amount: 12.5,
      date: '2026-03-01',
      account_id: 'paypal',
      category: 'rent',
      notes: 'March',
    });
    expect(buildExpenseInput({ ...base, accountId: 'bank' }).account_id).toBe('bank');
  });

  it('uses the custom category and reason for "other"', () => {
    const input = buildExpenseInput({ ...base, category: 'other', customCategory: 'Stamps' });
    expect(input.category).toBe('Stamps');
    expect(input.reason).toBe('Stamps');
  });

  it('falls back to "other" when no custom category is given', () => {
    const input = buildExpenseInput({ ...base, category: 'other', customCategory: '' });
    expect(input.category).toBe('other');
  });
});

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
