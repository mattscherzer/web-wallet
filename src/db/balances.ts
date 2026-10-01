import type { AccountId } from './accounts';
import type { Transaction } from './database';

/**
 * The fields balance computation needs. `amount` may arrive from Postgres
 * `numeric` columns as a string, so both forms are accepted.
 */
export type BalanceInput = Pick<Transaction, 'type' | 'account_id' | 'from_account_id'> & {
  amount: number | string;
  deleted?: boolean;
};

export function emptyBalances(): Record<AccountId, number> {
  return { cash: 0, paypal: 0, bank: 0, prudent_reserve: 0 };
}

/**
 * Per-account balances from a list of transactions.
 *
 * - inflow:   credits `account_id`
 * - outflow:  debits `account_id`
 * - transfer: credits `account_id` (destination), debits `from_account_id` (source)
 *
 * Soft-deleted transactions are skipped.
 */
export function computeAccountBalances(
  transactions: Iterable<BalanceInput>
): Record<AccountId, number> {
  const balances = emptyBalances();

  for (const t of transactions) {
    if (t.deleted) continue;

    const amount = Number(t.amount);

    if (t.type === 'inflow') {
      balances[t.account_id] += amount;
    } else if (t.type === 'outflow') {
      balances[t.account_id] -= amount;
    } else if (t.type === 'transfer') {
      balances[t.account_id] += amount; // destination
      if (t.from_account_id) {
        balances[t.from_account_id] -= amount; // source
      }
    }
  }

  return balances;
}
