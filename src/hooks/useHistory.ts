import type { Transaction } from '../domain/transaction';
import { fetchTransactions } from '../db/queries';
import { useWalletData } from './useWalletQuery';

// ─── Filtered transactions ──────────────────────────────
export function useFilteredTransactions(
  filter: 'all' | 'inflow' | 'outflow' | 'transfer',
  searchQuery: string,
  includeRemoved = false,
) {
  return useWalletData<Transaction[]>(
    async (walletId) => {
      let results = await fetchTransactions(walletId, {
        type: filter === 'all' ? undefined : filter,
        removed: includeRemoved ? 'include' : 'exclude',
      });

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        results = results.filter(
          (t) =>
            t.category.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            (t.reason && t.reason.toLowerCase().includes(q)),
        );
      }

      return results;
    },
    [filter, searchQuery, includeRemoved],
    [],
    'transactions',
  );
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
