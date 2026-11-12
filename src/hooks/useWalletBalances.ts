import { useEffect, useState } from 'react';
import { fetchWalletAvailableBalances } from '../db/wallets';
import type { Wallet } from '../domain/wallet';

/** Available balance per wallet; `balances` is null until the first answer, `failed` after an error until `retry`. */
export function useWalletBalances(wallets: Wallet[]) {
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetchWalletAvailableBalances(wallets.map((w) => w.id))
      .then((b) => {
        if (!live) return;
        setBalances(b);
        setFailed(false);
      })
      .catch((err) => {
        console.error('Failed to load wallet balances:', err);
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [wallets, attempt]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  return { balances, failed, retry };
}
