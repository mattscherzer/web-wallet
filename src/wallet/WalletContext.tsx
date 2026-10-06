import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createWallet, fetchWallets, type Wallet } from '../db/wallets';
import { pickCurrentWallet, readCurrentWalletId, writeCurrentWalletId } from './walletStore';

type WalletStorage = Pick<Storage, 'getItem' | 'setItem'>;

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

const WalletContext = createContext<WalletValue | null>(null);

function defaultStorage(): WalletStorage {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}

export function WalletProvider({ children, storage }: { children: ReactNode; storage?: WalletStorage }) {
  const store = useMemo(() => storage ?? defaultStorage(), [storage]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [status, setStatus] = useState<WalletValue['status']>('loading');
  const [storedId, setStoredId] = useState(() => readCurrentWalletId(store));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetchWallets()
      .then((list) => {
        if (!live) return;
        setWallets(list);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Failed to load wallets:', err);
        if (live) setStatus('error');
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const switchWallet = useCallback(
    (id: string) => {
      setStoredId(id);
      writeCurrentWalletId(store, id);
    },
    [store],
  );

  const addWallet = useCallback(
    async (name: string) => {
      const created = await createWallet(name);
      setWallets((list) => [...list, created]);
      switchWallet(created.id);
      return created;
    },
    [switchWallet],
  );

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<WalletValue>(
    () => ({
      wallets,
      current: status === 'ready' ? pickCurrentWallet(wallets, storedId) : null,
      status,
      switchWallet,
      addWallet,
      reload,
    }),
    [wallets, status, storedId, switchWallet, addWallet, reload],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWallet(): WalletValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet must be used inside <WalletProvider>');
  return value;
}

/** For shared chrome that should simply draw nothing outside a provider. */
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalWallet(): WalletValue | null {
  return useContext(WalletContext);
}
