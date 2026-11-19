export const CURRENT_WALLET_KEY = 'treasury.currentWalletId';

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
    console.warn('Could not remember the chosen wallet on this device.', err);
  }
}
