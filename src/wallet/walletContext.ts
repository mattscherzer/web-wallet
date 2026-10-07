import { createContext } from 'react';
import type { Wallet } from '../db/wallets';

export interface WalletValue {
  wallets: Wallet[];
  /** The open wallet; `null` while loading, after a failed load, or when there is none. */
  current: Wallet | null;
  status: 'loading' | 'ready' | 'error';
  switchWallet: (id: string) => void;
  /** Creates a wallet and opens it. Rejects with the reason if it could not be created. */
  addWallet: (name: string) => Promise<Wallet>;
  reload: () => void;
}

export const WalletContext = createContext<WalletValue | null>(null);
