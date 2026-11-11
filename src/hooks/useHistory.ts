import { useMemo } from 'react';
import { matchesSearch, type Transaction } from '../domain/transaction';
import { fetchTransactions } from '../db/queries';
import { useWalletData } from './useWalletQuery';

// ─── Filtered transactions ──────────────────────────────
export function useFilteredTransactions(
  filter: 'all' | 'inflow' | 'outflow' | 'transfer',
  searchQuery: string,
  includeRemoved = false,
) {
  const fetched = useWalletData<Transaction[]>(
    (walletId) =>
      fetchTransactions(walletId, {
        type: filter === 'all' ? undefined : filter,
        removed: includeRemoved ? 'include' : 'exclude',
      }),
    [filter, includeRemoved],
    [],
    'transactions',
  );
  return useMemo(() => fetched.filter((t) => matchesSearch(t, searchQuery)), [fetched, searchQuery]);
}

// ─── Recent transactions ────────────────────────────────
export function useRecentTransactions(limit = 5) {
  return useWalletData<Transaction[]>(
    (walletId) => fetchTransactions(walletId, { limit }),
    [limit],
    [],
    'transactions',
  );
}
