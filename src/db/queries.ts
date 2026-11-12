import { supabase } from './supabase';
import type { AccountId } from '../domain/accounts';
import type { AuditEntry, Transaction, TransactionType } from '../domain/transaction';
import { computeAccountBalances, type BalanceInput } from '../domain/balances';

const PAGE_SIZE = 1000;

/** Reads every row, a page at a time: the API returns at most 1000 rows per request. */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export interface TransactionQuery {
  type?: TransactionType;
  /** Removed entries are left out by default; they never count in balances. */
  removed?: 'exclude' | 'include';
  limit?: number;
  /** Oldest first. Default is newest first. */
  ascending?: boolean;
}

export async function fetchTransactions(
  walletId: string,
  { type, removed = 'exclude', limit, ascending = false }: TransactionQuery = {},
): Promise<Transaction[]> {
  const build = () => {
    // `id` last: pages are only stable when the order has no ties.
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('date', { ascending })
      .order('created_at', { ascending })
      .order('id', { ascending });
    if (removed === 'exclude') query = query.eq('deleted', false);
    if (type) query = query.eq('type', type);
    return query;
  };

  if (limit === undefined) return fetchAllRows<Transaction>((from, to) => build().range(from, to));
  const { data, error } = await build().limit(limit);
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

/** One entry of this wallet, removed or not; null when there is none. */
export async function fetchTransaction(walletId: string, id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_id', walletId)
    .eq('id', id)
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as Transaction | undefined) ?? null;
}

export async function fetchAccountBalances(walletId: string): Promise<Record<AccountId, number>> {
  const rows = await fetchAllRows<BalanceInput>((from, to) =>
    supabase
      .from('transactions')
      .select('type, amount, account_id, from_account_id')
      .eq('wallet_id', walletId)
      .eq('deleted', false)
      .order('id')
      .range(from, to),
  );
  return computeAccountBalances(rows);
}

export async function fetchAuditLog(walletId: string, transactionId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('wallet_id', walletId)
    .eq('transaction_id', transactionId)
    .order('timestamp', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}
