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
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ─── Generic hook for Supabase queries with real-time ───
function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[],
  initialValue: T,
  realtimeTable?: string
): T {
  const [data, setData] = useState<T>(initialValue);

  const refresh = useCallback(async () => {
    try {
      const result = await queryFn();
      setData(result);
    } catch (err) {
      console.error('Supabase query error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!realtimeTable) return;

    const channel = supabase
      .channel(`${realtimeTable}-changes-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: realtimeTable },
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeTable, refresh]);

  return data;
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
  return useSupabaseQuery<Transaction[]>(
    async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('deleted', false)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    [],
    [],
    'transactions'
  );
}

// ─── Filtered transactions ──────────────────────────────
export function useFilteredTransactions(
  filter: 'all' | 'inflow' | 'outflow' | 'transfer',
  searchQuery: string
) {
  return useSupabaseQuery<Transaction[]>(
    async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('deleted', false)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('type', filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = (data ?? []) as Transaction[];

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
    async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, account_id, from_account_id')
        .eq('deleted', false);

      if (error) throw error;

      const balances: Record<AccountId, number> = {
        cash: 0,
        paypal: 0,
        bank: 0,
        prudent_reserve: 0,
      };

      for (const t of data ?? []) {
        const amount = Number(t.amount);
        const accountId = t.account_id as AccountId;

        if (t.type === 'inflow') {
          balances[accountId] += amount;
        } else if (t.type === 'outflow') {
          balances[accountId] -= amount;
        } else if (t.type === 'transfer') {
          // Transfer: debit source, credit destination
          balances[accountId] += amount; // destination (account_id)
          if (t.from_account_id) {
            balances[t.from_account_id as AccountId] -= amount; // source
          }
        }
      }

      return balances;
    },
    [],
    { cash: 0, paypal: 0, bank: 0, prudent_reserve: 0 },
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
    async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('deleted', false)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    [limit],
    [],
    'transactions'
  );
}

// ─── Audit log for a transaction ────────────────────────
export function useAuditLog(transactionId: string) {
  return useSupabaseQuery<AuditEntry[]>(
    async () => {
      if (!transactionId) return [];
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
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
