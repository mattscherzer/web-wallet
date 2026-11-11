import { fetchTransactions } from '../db/queries';
import type { Transaction } from '../domain/transaction';
import { buildHistoryCsv } from '../domain/historyCsv';
import { downloadTextFile } from '../platform/download';

export async function exportHistory(walletId: string, walletName: string) {
  let data: Transaction[];
  try {
    data = await fetchTransactions(walletId, { ascending: true });
  } catch (error) {
    console.error('Failed to fetch transactions for export:', error);
    throw error;
  }

  downloadTextFile('treasury_report.csv', buildHistoryCsv(data, walletName), 'text/csv;charset=utf-8;');
}
