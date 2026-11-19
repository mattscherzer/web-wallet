import { createContext } from 'react';
import type { Wallet } from '../domain/wallet';

export interface WalletValue {
  wallets: Wallet[];
  current: Wallet | null;
  status: 'loading' | 'ready' | 'error';
  switchWallet: (id: string) => void;
  addWallet: (name: string) => Promise<Wallet>;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const WalletContext = createContext<WalletValue | null>(null);
