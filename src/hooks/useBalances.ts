import type { AccountId } from '../domain/accounts';
import { emptyBalances, summarizeBalances } from '../domain/balances';
import { fetchAccountBalances } from '../db/queries';
import { useWalletData } from './useWalletQuery';

export function useAccountBalances() {
  return useWalletData<Record<AccountId, number>>(fetchAccountBalances, [], emptyBalances(), 'transactions');
}

/** Like useAccountBalances, but `null` until balances have actually been fetched. */
export function useLoadedAccountBalances() {
  return useWalletData<Record<AccountId, number> | null>(fetchAccountBalances, [], null, 'transactions');
}

export function useBalanceSummary() {
  return summarizeBalances(useAccountBalances());
}
