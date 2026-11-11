import type { AccountId } from '../domain/accounts';
import { emptyBalances, summarizeBalances } from '../domain/balances';
import { fetchAccountBalances } from '../db/queries';
import { useWalletData } from './useWalletQuery';

// ─── Account balances (handles transfers correctly) ─────
export function useAccountBalances() {
  return useWalletData<Record<AccountId, number>>(fetchAccountBalances, [], emptyBalances(), 'transactions');
}

/** Like useAccountBalances, but `null` until balances have actually been fetched. */
export function useLoadedAccountBalances() {
  return useWalletData<Record<AccountId, number> | null>(fetchAccountBalances, [], null, 'transactions');
}

/** Main and reserve accounts with balances, plus the spendable (main) and overall totals. */
export function useBalanceSummary() {
  return summarizeBalances(useAccountBalances());
}
