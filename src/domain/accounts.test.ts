import { describe, expect, it } from 'vitest';
import { ACCOUNTS, MAIN_ACCOUNTS, RESERVE_ACCOUNTS, fromAccountLabel, getAccountLabel } from './accounts';

describe('accounts', () => {
  it('names each account by its display name', () => {
    expect(getAccountLabel('paypal')).toBe('PayPal Balance');
  });

  it('keeps the prudent reserve out of the main accounts', () => {
    expect(RESERVE_ACCOUNTS.map((a) => a.id)).toEqual(['prudent_reserve']);
    expect(MAIN_ACCOUNTS).toHaveLength(ACCOUNTS.length - 1);
  });

  it('labels a transfer without a source account as unknown', () => {
    expect(fromAccountLabel({ from_account_id: null })).toBe('Unknown account');
    expect(fromAccountLabel({ from_account_id: 'bank' })).toBe('Bank Account');
  });
});
