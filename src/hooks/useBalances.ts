import type { AccountId } from '../domain/accounts';
import { emptyBalances, summarizeBalances } from '../domain/balances';
import { fetchAccountBalances } from '../db/queries';
import { useWalletData, useWalletQuery } from './useWalletQuery';

function useAccountBalancesQuery() {
  return useWalletQuery<Record<AccountId, number>>(fetchAccountBalances, [], emptyBalances(), 'transactions');
}

export function useAccountBalances() {
  return useAccountBalancesQuery().data;
}

/** Like useAccountBalances, but `null` until balances have actually been fetched. */
export function useLoadedAccountBalances() {
  return useWalletData<Record<AccountId, number> | null>(fetchAccountBalances, [], null, 'transactions');
}

/** `loaded` is false until the open wallet has answered: the balances are zeros until then. */
export function useBalanceSummary() {
  const { data, loaded, failed, refresh } = useAccountBalancesQuery();
  return { ...summarizeBalances(data), loaded, failed, refresh };
}
