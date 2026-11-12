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
