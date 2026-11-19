import { useContext } from 'react';
import { WalletContext, type WalletValue } from './walletContext';

export function useWallet(): WalletValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet must be used inside <WalletProvider>');
  return value;
}

export function useOptionalWallet(): WalletValue | null {
  return useContext(WalletContext);
}
