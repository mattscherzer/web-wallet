import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import {
  MAIN_ACCOUNTS,
  RESERVE_ACCOUNTS,
  type Transaction,
  type Account,
  type AccountId,
  type AuditEntry,
} from './database';
import { emptyBalances } from './balances';
import { fetchAccountBalances, fetchAuditLog, fetchTransaction, fetchTransactions } from './queries';
import { useOptionalWallet } from '../wallet/useWallet';

// ─── Generic hook for Supabase queries with real-time ───
// Everything is scoped to the open wallet: the query gets its id, the live
// channel only listens to its rows, and data fetched for another wallet is
// never returned.
interface QueryState<T> {
  data: T;
  /** True once the open wallet has answered at least once; a later failed refresh keeps the data on screen. */
  loaded: boolean;
  /** True only while the open wallet has never answered and its request failed. */
  failed: boolean;
  refresh: () => Promise<void>;
}

function useQueryState<T>(
  queryFn: (walletId: string) => Promise<T>,
  deps: unknown[],
  initialValue: T,
  realtimeTable?: string,
): QueryState<T> {
  const walletId = useOptionalWallet()?.current?.id ?? null;
  const [state, setState] = useState<{
    walletId: string | null;
    data: T;
    loaded: boolean;
    failed: boolean;
  }>({
    walletId: null,
    data: initialValue,
    loaded: false,
    failed: false,
  });

  // An answer for a wallet we have since left must not replace the current wallet's data.
  const openWalletId = useRef(walletId);
  useEffect(() => {
    openWalletId.current = walletId;
  }, [walletId]);

  const refresh = useCallback(async () => {
    if (!walletId) return;
    try {
      const result = await queryFn(walletId);
      if (openWalletId.current === walletId)
        setState({
          walletId,
          data: result,
          loaded: true,
          failed: false,
        });
    } catch (err) {
      console.error('Supabase query error:', err);
      if (openWalletId.current !== walletId) return;
      // Keep this wallet's data if it has some; never carry over another wallet's.
      setState((prev) =>
        prev.walletId === walletId
          ? { ...prev, failed: true }
          : {
              walletId,
              data: initialValue,
              loaded: false,
              failed: true,
            },
      );
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
        {
          event: '*',
          schema: 'public',
          table: realtimeTable,
          filter: `wallet_id=eq.${walletId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeTable, walletId, refresh]);

  const current = state.walletId === walletId;
  return {
    data: current ? state.data : initialValue,
    loaded: current && state.loaded,
    failed: current && state.failed && !state.loaded,
    refresh,
  };
}

function useSupabaseQuery<T>(
  queryFn: (walletId: string) => Promise<T>,
  deps: unknown[],
  initialValue: T,
  realtimeTable?: string,
): T {
  return useQueryState(queryFn, deps, initialValue, realtimeTable).data;
}

// ─── All active transactions ────────────────────────────
export function useTransactions() {
  return useSupabaseQuery<Transaction[]>((walletId) => fetchTransactions(walletId), [], [], 'transactions');
}

// ─── Filtered transactions ──────────────────────────────
export function useFilteredTransactions(
  filter: 'all' | 'inflow' | 'outflow' | 'transfer',
  searchQuery: string,
  includeRemoved = false,
) {
  return useSupabaseQuery<Transaction[]>(
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

// ─── Account balances (handles transfers correctly) ─────
export function useAccountBalances() {
  return useSupabaseQuery<Record<AccountId, number>>(fetchAccountBalances, [], emptyBalances(), 'transactions');
}

/** Like useAccountBalances, but `null` until balances have actually been fetched. */
export function useLoadedAccountBalances() {
  return useSupabaseQuery<Record<AccountId, number> | null>(fetchAccountBalances, [], null, 'transactions');
}

// ─── Balances grouped for display (one query) ───────────
const sumBalances = (accounts: { balance: number }[]) => accounts.reduce((sum, a) => sum + a.balance, 0);

/** Main and reserve accounts with balances, plus the spendable (main) and overall totals. */
export function useBalanceSummary() {
  const balances = useAccountBalances();
  const withBalance = (account: Account) => ({
    ...account,
    balance: balances[account.id] ?? 0,
  });
  const main = MAIN_ACCOUNTS.map(withBalance);
  const reserve = RESERVE_ACCOUNTS.map(withBalance);
  const spendableTotal = sumBalances(main);
  return {
    main,
    reserve,
    spendableTotal,
    grandTotal: spendableTotal + sumBalances(reserve),
  };
}

// ─── Recent transactions ────────────────────────────────
export function useRecentTransactions(limit = 5) {
  return useSupabaseQuery<Transaction[]>(
    (walletId) => fetchTransactions(walletId, { limit }),
    [limit],
    [],
    'transactions',
  );
}

// ─── Audit log for a transaction ────────────────────────
export function useAuditLog(transactionId: string) {
  return useSupabaseQuery<AuditEntry[]>(
    async (walletId) => (transactionId ? fetchAuditLog(walletId, transactionId) : []),
    [transactionId],
    [],
    'audit_log',
  );
}

// ─── One entry with its change history ──────────────────
export type EntryStatus = 'loading' | 'ready' | 'missing' | 'error';

/** An entry (removed or not) and its history. `refresh` re-reads both after a change. */
export function useEntry(id: string) {
  const { data, loaded, failed, refresh } = useQueryState<{
    tx: Transaction | null;
    audit: AuditEntry[];
  } | null>(
    async (walletId) => {
      const tx = await fetchTransaction(walletId, id);
      return { tx, audit: tx ? await fetchAuditLog(walletId, id) : [] };
    },
    [id],
    null,
    'transactions',
  );
  const status: EntryStatus = failed ? 'error' : !loaded || !data ? 'loading' : data.tx ? 'ready' : 'missing';
  return { status, tx: data?.tx ?? null, audit: data?.audit ?? [], refresh };
}
