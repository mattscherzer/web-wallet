import { describe, expect, it } from 'vitest';
import {
  CURRENT_WALLET_KEY,
  pickCurrentWallet,
  readCurrentWalletId,
  walletInitials,
  writeCurrentWalletId,
} from './walletStore';

const wallets = [
  { id: 'a', name: 'A', currency: 'EUR' as const, created_at: '' },
  { id: 'b', name: 'B', currency: 'EUR' as const, created_at: '' },
];

describe('walletStore', () => {
  it('remembers the chosen wallet in storage', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    writeCurrentWalletId(storage, 'b');
    expect(mem.get(CURRENT_WALLET_KEY)).toBe('b');
    expect(readCurrentWalletId(storage)).toBe('b');
  });

  it('does not crash when storage is blocked', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    expect(readCurrentWalletId(broken)).toBeNull();
    expect(() => writeCurrentWalletId(broken, 'a')).not.toThrow();
  });

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
});
