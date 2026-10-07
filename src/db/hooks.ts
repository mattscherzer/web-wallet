import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import {
  ACCOUNTS,
  MAIN_ACCOUNTS,
  RESERVE_ACCOUNTS,
  fetchPin,
  type Transaction,
  type AccountId,
  type AuditEntry,
} from './database';
import { emptyBalances } from './balances';
import { fetchAccountBalances, fetchAuditLog, fetchTransactions } from './queries';
import { useOptionalWallet } from '../wallet/useWallet';

// ─── Generic hook for Supabase queries with real-time ───
// Everything is scoped to the open wallet: the query gets its id, the live
// channel only listens to its rows, and data fetched for another wallet is
// never returned.
function useSupabaseQuery<T>(
  queryFn: (walletId: string) => Promise<T>,
  deps: unknown[],
  initialValue: T,
  realtimeTable?: string
): T {
  const walletId = useOptionalWallet()?.current?.id ?? null;
  const [state, setState] = useState<{ walletId: string | null; data: T }>({
    walletId: null,
    data: initialValue,
  });

  const refresh = useCallback(async () => {
    if (!walletId) return;
    try {
      const result = await queryFn(walletId);
      setState({ walletId, data: result });
    } catch (err) {
      console.error('Supabase query error:', err);
    }
    // `deps` has a fixed length per hook, so the spread is stable between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, [walletId, ...deps]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!realtimeTable || !walletId) return;

    const channel = supabase
      .channel(`${realtimeTable}-changes-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: realtimeTable, filter: `wallet_id=eq.${walletId}` },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeTable, walletId, refresh]);

  return state.walletId === walletId ? state.data : initialValue;
}

// ─── PIN from database ──────────────────────────────────
export function usePin() {
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    fetchPin().then(setPin);
  }, []);

  return pin;
}

// ─── All active transactions ────────────────────────────
export function useTransactions() {
  return useSupabaseQuery<Transaction[]>((walletId) => fetchTransactions(walletId), [], [], 'transactions');
}

// ─── Filtered transactions ──────────────────────────────
export function useFilteredTransactions(
  filter: 'all' | 'inflow' | 'outflow' | 'transfer',
  searchQuery: string
) {
  return useSupabaseQuery<Transaction[]>(
    async (walletId) => {
      let results = await fetchTransactions(walletId, {
        type: filter === 'all' ? undefined : filter,
      });

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        results = results.filter(
          (t) =>
            t.category.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            (t.reason && t.reason.toLowerCase().includes(q))
        );
      }

      return results;
    },
    [filter, searchQuery],
    [],
    'transactions'
  );
}

// ─── Account balances (handles transfers correctly) ─────
export function useAccountBalances() {
  return useSupabaseQuery<Record<AccountId, number>>(
    fetchAccountBalances,
    [],
    emptyBalances(),
    'transactions'
  );
}

/** Like useAccountBalances, but `null` until balances have actually been fetched. */
export function useLoadedAccountBalances() {
  return useSupabaseQuery<Record<AccountId, number> | null>(
    fetchAccountBalances,
    [],
    null,
    'transactions'
  );
}

// ─── Total balance (excludes reserve) ───────────────────
export function useTotalBalance() {
  const balances = useAccountBalances();
  return MAIN_ACCOUNTS.reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);
}

// ─── Recent transactions ────────────────────────────────
export function useRecentTransactions(limit = 5) {
  return useSupabaseQuery<Transaction[]>(
    (walletId) => fetchTransactions(walletId, { limit }),
    [limit],
    [],
    'transactions'
  );
}

// ─── Audit log for a transaction ────────────────────────
export function useAuditLog(transactionId: string) {
  return useSupabaseQuery<AuditEntry[]>(
    async (walletId) => (transactionId ? fetchAuditLog(walletId, transactionId) : []),
    [transactionId],
    [],
    'audit_log'
  );
}

// ─── Main accounts with balances ────────────────────────
export function useMainAccountsWithBalances() {
  const balances = useAccountBalances();
  return MAIN_ACCOUNTS.map((account) => ({
    ...account,
    balance: balances[account.id] ?? 0,
  }));
}

// ─── Reserve accounts with balances ─────────────────────
export function useReserveAccountsWithBalances() {
  const balances = useAccountBalances();
  return RESERVE_ACCOUNTS.map((account) => ({
    ...account,
    balance: balances[account.id] ?? 0,
  }));
}

// ─── All accounts with balances (for backwards compat) ──
export function useAccountsWithBalances() {
  const balances = useAccountBalances();
  return ACCOUNTS.map((account) => ({
    ...account,
    balance: balances[account.id] ?? 0,
  }));
}
