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

export function useLoadedAccountBalances() {
  return useWalletData<Record<AccountId, number> | null>(fetchAccountBalances, [], null, 'transactions');
}

export function useBalanceSummary() {
  const { data, loaded, failed, refresh } = useAccountBalancesQuery();
  return { ...summarizeBalances(data), loaded, failed, refresh };
}
