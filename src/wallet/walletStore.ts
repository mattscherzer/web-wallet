import type { Wallet } from '../db/wallets';

export const CURRENT_WALLET_KEY = 'treasury.currentWalletId';

/**
 * Storage can throw (private mode, blocked site data). Reading then behaves as
 * "nothing remembered", so the first wallet opens. The failure is logged, not shown.
 */
export function readCurrentWalletId(storage: Pick<Storage, 'getItem'>): string | null {
  try {
    return storage.getItem(CURRENT_WALLET_KEY);
  } catch (err) {
    console.warn('Could not read the remembered wallet; opening the first one.', err);
    return null;
  }
}

export function writeCurrentWalletId(storage: Pick<Storage, 'setItem'>, id: string): void {
  try {
    storage.setItem(CURRENT_WALLET_KEY, id);
  } catch (err) {
    // The switch still works for this session; it just won't survive a reload.
    console.warn('Could not remember the chosen wallet on this device.', err);
  }
}

/** The remembered wallet if it still exists, otherwise the first one, otherwise none. */
export function pickCurrentWallet(wallets: Wallet[], storedId: string | null): Wallet | null {
  return wallets.find((w) => w.id === storedId) ?? wallets[0] ?? null;
}

/** Up to two letters for the wallet avatar. */
export function walletInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
