export const MAX_WALLET_NAME = 60;

export interface Wallet {
  id: string;
  name: string;
  currency: 'EUR';
  created_at: string;
}

/** A problem with the name the user typed, safe to show as is. */
export class WalletNameError extends Error {}

/** The trimmed name, or a WalletNameError saying what is wrong with it. */
export function validateWalletName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new WalletNameError('Enter a wallet name');
  if (name.length > MAX_WALLET_NAME) {
    throw new WalletNameError(`That name is too long (max ${MAX_WALLET_NAME} characters)`);
  }
  return name;
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
