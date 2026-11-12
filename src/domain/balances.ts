import { MAIN_ACCOUNTS, RESERVE_ACCOUNTS, type Account, type AccountId } from './accounts';
import type { Transaction } from './transaction';

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

/** A transfer credits `account_id` (the destination) and debits `from_account_id`; removed entries are skipped. */
export function computeAccountBalances(transactions: Iterable<BalanceInput>): Record<AccountId, number> {
  const balances = emptyBalances();

  for (const t of transactions) {
    if (t.deleted) continue;

    const amount = Number(t.amount);

    if (t.type === 'inflow') {
      balances[t.account_id] += amount;
    } else if (t.type === 'outflow') {
      balances[t.account_id] -= amount;
    } else if (t.type === 'transfer') {
      balances[t.account_id] += amount;
      if (t.from_account_id) {
        balances[t.from_account_id] -= amount;
      }
    }
  }

  return balances;
}

type WalletBalanceRow = BalanceInput & { wallet_id: string };

/** Available money (operating accounts only) per wallet; wallets without entries are 0. */
export function availableByWallet(walletIds: string[], rows: WalletBalanceRow[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const id of walletIds) {
    const balances = computeAccountBalances(rows.filter((r) => r.wallet_id === id));
    const total = MAIN_ACCOUNTS.reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);
    result[id] = Math.round(total * 100) / 100;
  }
  return result;
}

const sumBalances = (accounts: { balance: number }[]) => accounts.reduce((sum, a) => sum + a.balance, 0);

export function summarizeBalances(balances: Record<AccountId, number>) {
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
