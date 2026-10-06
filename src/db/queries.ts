import { supabase } from './supabase';
import type { AccountId } from './accounts';
import type { AuditEntry, Transaction, TransactionType } from './database';
import { computeAccountBalances, type BalanceInput } from './balances';

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
  limit?: number;
  /** Oldest first. Default is newest first. */
  ascending?: boolean;
}

export async function fetchTransactions(
  walletId: string,
  { type, limit, ascending = false }: TransactionQuery = {},
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('wallet_id', walletId)
    .eq('deleted', false)
    .order('date', { ascending })
    .order('created_at', { ascending });

  if (type) query = query.eq('type', type);
  if (limit !== undefined) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Transaction[];
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
