// Shared setup for component tests that run against the fake Supabase client.
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { WalletProvider } from '../wallet/WalletContext';
import { CURRENT_WALLET_KEY } from '../wallet/walletStore';

export function memoryStorage(initial: Record<string, string> = {}) {
  const mem = new Map(Object.entries(initial));
  return {
    mem,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  };
}

export function walletApp(
  children: ReactNode,
  opts: { storage?: ReturnType<typeof memoryStorage>; path?: string; current?: string } = {},
) {
  const storage = opts.storage ?? memoryStorage(opts.current ? { [CURRENT_WALLET_KEY]: opts.current } : {});
  return (
    <MemoryRouter initialEntries={[opts.path ?? '/']}>
      <WalletProvider storage={storage}>{children}</WalletProvider>
    </MemoryRouter>
  );
}
