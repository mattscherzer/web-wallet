import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickCurrentWallet, readCurrentWalletId, writeCurrentWalletId } from './walletStore';

const broken = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
};

afterEach(() => vi.restoreAllMocks());

describe('blocked storage', () => {
  it('opens the first wallet and logs why when the remembered choice cannot be read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wallets = [{ id: 'a', name: 'A', currency: 'EUR' as const, created_at: '' }];
    expect(pickCurrentWallet(wallets, readCurrentWalletId(broken))?.id).toBe('a');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('keeps the switch working and logs why when the choice cannot be saved', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => writeCurrentWalletId(broken, 'b')).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});
