import { useLiveQuery } from 'dexie-react-hooks';
import { db, ACCOUNTS, type Transaction, type AccountId, type AuditEntry } from './database';

// ─── All active (non-deleted) transactions ──────────────
export function useTransactions() {
  return useLiveQuery(
    () => db.transactions.where('deleted').equals(0).sortBy('date'),
    [],
    [] as Transaction[]
  );
}

// ─── Transactions filtered by type ──────────────────────
export function useFilteredTransactions(
  filter: 'all' | 'inflow' | 'outflow',
  searchQuery: string
) {
  return useLiveQuery(
    async () => {
      let results = await db.transactions
        .where('deleted')
        .equals(0)
        .toArray();

      if (filter !== 'all') {
        results = results.filter((t) => t.type === filter);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        results = results.filter(
          (t) =>
            t.category.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            (t.reason && t.reason.toLowerCase().includes(q))
        );
      }

      // Sort by date descending
      results.sort((a, b) => b.date.localeCompare(a.date));
      return results;
    },
    [filter, searchQuery],
    [] as Transaction[]
  );
}

// ─── Account balances ───────────────────────────────────
export function useAccountBalances() {
  return useLiveQuery(
    async () => {
      const transactions = await db.transactions
        .where('deleted')
        .equals(0)
        .toArray();

      const balances: Record<AccountId, number> = {
        cash: 0,
        paypal: 0,
        bank: 0,
      };

      for (const t of transactions) {
        if (t.type === 'inflow') {
          balances[t.accountId] += t.amount;
        } else {
          balances[t.accountId] -= t.amount;
        }
      }

      return balances;
    },
    [],
    { cash: 0, paypal: 0, bank: 0 } as Record<AccountId, number>
  );
}

// ─── Total balance ──────────────────────────────────────
export function useTotalBalance() {
  const balances = useAccountBalances();
  if (!balances) return 0;
  return Object.values(balances).reduce((sum, b) => sum + b, 0);
}

// ─── Recent transactions (for dashboard) ────────────────
export function useRecentTransactions(limit = 5) {
  return useLiveQuery(
    async () => {
      const all = await db.transactions
        .where('deleted')
        .equals(0)
        .toArray();

      all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      return all.slice(0, limit);
    },
    [limit],
    [] as Transaction[]
  );
}

// ─── Audit log for a specific transaction ───────────────
export function useAuditLog(transactionId: string) {
  return useLiveQuery(
    () =>
      db.auditLog
        .where('transactionId')
        .equals(transactionId)
        .sortBy('timestamp'),
    [transactionId],
    [] as AuditEntry[]
  );
}

// ─── Check if transaction was edited ────────────────────
export function useIsEdited(transactionId: string) {
  return useLiveQuery(
    async () => {
      const entries = await db.auditLog
        .where('transactionId')
        .equals(transactionId)
        .toArray();
      return entries.some((e) => e.action === 'update');
    },
    [transactionId],
    false
  );
}

// ─── Accounts with balances ─────────────────────────────
export function useAccountsWithBalances() {
  const balances = useAccountBalances();
  return ACCOUNTS.map((account) => ({
    ...account,
    balance: balances?.[account.id] ?? 0,
  }));
}
