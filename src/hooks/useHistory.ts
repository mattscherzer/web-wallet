import { useMemo } from 'react';
import { matchesSearch, type Transaction } from '../domain/transaction';
import { fetchTransactions } from '../db/queries';
import { useWalletQuery } from './useWalletQuery';

/** The filtered entries, and whether the open wallet has answered yet. */
export function useFilteredTransactionsState(
  filter: 'all' | 'inflow' | 'outflow' | 'transfer',
  searchQuery: string,
  includeRemoved = false,
) {
  const {
    data: fetched,
    loaded,
    failed,
    refresh,
  } = useWalletQuery<Transaction[]>(
    (walletId) =>
      fetchTransactions(walletId, {
        type: filter === 'all' ? undefined : filter,
        removed: includeRemoved ? 'include' : 'exclude',
      }),
    [filter, includeRemoved],
    [],
    'transactions',
  );
  const transactions = useMemo(() => fetched.filter((t) => matchesSearch(t, searchQuery)), [fetched, searchQuery]);
  return { transactions, loaded, failed, refresh };
}

/** The latest entries, and whether the open wallet has answered yet. */
export function useRecentTransactions(limit = 5) {
  return useWalletQuery<Transaction[]>(
    (walletId) => fetchTransactions(walletId, { limit }),
    [limit],
    [],
    'transactions',
  );
}
