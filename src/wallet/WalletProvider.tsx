import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createWallet, fetchWallets } from '../db/wallets';
import { type Wallet } from '../domain/wallet';
import { WalletContext, type WalletValue } from './walletContext';
import { pickCurrentWallet } from '../domain/wallet';
import { safeStorage } from '../platform/storage';
import { readCurrentWalletId, writeCurrentWalletId } from './walletStore';

type WalletStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function WalletProvider({ children, storage }: { children: ReactNode; storage?: WalletStorage }) {
  const store = useMemo(() => storage ?? safeStorage, [storage]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [status, setStatus] = useState<WalletValue['status']>('loading');
  const [storedId, setStoredId] = useState(() => readCurrentWalletId(store));

  const newest = useRef(0);
  const reload = useCallback(() => {
    const mine = ++newest.current;
    return fetchWallets().then(
      (list) => {
        if (mine !== newest.current) return;
        setWallets(list);
        setStatus('ready');
      },
      (err) => {
        console.error('Failed to load wallets:', err);
        if (mine === newest.current) setStatus('error');
      },
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const refresh = useCallback(async () => {
    const mine = ++newest.current;
    try {
      const list = await fetchWallets();
      if (mine === newest.current) setWallets(list);
    } catch (err) {
      console.error('Failed to refresh the wallets:', err);
    }
  }, []);

  const value = useMemo<WalletValue>(
    () => ({
      wallets,
      current: status === 'ready' ? pickCurrentWallet(wallets, storedId) : null,
      status,
      switchWallet,
      addWallet,
      reload,
      refresh,
    }),
    [wallets, status, storedId, switchWallet, addWallet, reload, refresh],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
