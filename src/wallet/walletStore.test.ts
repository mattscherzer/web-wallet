import { describe, expect, it } from 'vitest';
import { CURRENT_WALLET_KEY, readCurrentWalletId, writeCurrentWalletId } from './walletStore';

describe('walletStore', () => {
  it('remembers the chosen wallet in storage', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    writeCurrentWalletId(storage, 'b');
    expect(mem.get(CURRENT_WALLET_KEY)).toBe('b');
    expect(readCurrentWalletId(storage)).toBe('b');
  });

  it('does not crash when storage is blocked', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readCurrentWalletId(broken)).toBeNull();
    expect(() => writeCurrentWalletId(broken, 'a')).not.toThrow();
  });
});
