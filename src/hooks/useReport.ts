import { useCallback, useMemo } from 'react';
import { fetchReportTransactions } from '../db/queries';
import { buildReport, type Period } from '../domain/reports';
import type { Transaction } from '../domain/transaction';
import { useWalletQuery } from './useWalletQuery';

export function useReport(period: Period) {
  const {
    data: transactions,
    loaded,
    failed,
    refresh,
  } = useWalletQuery<Transaction[]>(fetchReportTransactions, [], [], 'transactions');
  const report = useMemo(() => buildReport(period, transactions), [period, transactions]);
  const reportFor = useCallback(
    (other: Period) => (loaded ? buildReport(other, transactions) : null),
    [loaded, transactions],
  );
  return { report: loaded ? report : null, reportFor, loaded, failed, refresh };
}
