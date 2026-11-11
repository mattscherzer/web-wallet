import { describe, expect, it } from 'vitest';
import { MAX_WALLET_NAME, pickCurrentWallet, validateWalletName, walletInitials, WalletNameError } from './wallet';

const wallets = [
  { id: 'a', name: 'A', currency: 'EUR' as const, created_at: '' },
  { id: 'b', name: 'B', currency: 'EUR' as const, created_at: '' },
];

describe('wallet', () => {
  it('picks the remembered wallet, else the first one, else none', () => {
    expect(pickCurrentWallet(wallets, 'b')?.id).toBe('b');
    expect(pickCurrentWallet(wallets, 'gone')?.id).toBe('a');
    expect(pickCurrentWallet(wallets, null)?.id).toBe('a');
    expect(pickCurrentWallet([], 'a')).toBeNull();
  });

  it('makes two-letter initials from the wallet name', () => {
    expect(walletInitials('Thursday Night Group')).toBe('TN');
    expect(walletInitials('Spring Convention 2027')).toBe('SC');
    expect(walletInitials('treasury')).toBe('T');
    expect(walletInitials('  ')).toBe('?');
  });

  it('trims a wallet name and refuses a blank or too long one', () => {
    expect(validateWalletName('  Autumn Retreat  ')).toBe('Autumn Retreat');
    expect(() => validateWalletName('   ')).toThrow(WalletNameError);
    expect(() => validateWalletName('x'.repeat(MAX_WALLET_NAME + 1))).toThrow(/too long/);
    expect(validateWalletName('x'.repeat(MAX_WALLET_NAME))).toHaveLength(MAX_WALLET_NAME);
  });
});
