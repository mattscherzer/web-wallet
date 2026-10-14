import { fetchTransactions } from '../db/queries';
import { fetchAuthorNames } from '../db/admin';
import type { Transaction } from '../db/database';
import { buildHistoryCsv } from './historyCsv';

export async function generateHistoryCsv(walletId: string, walletName: string) {
  let data: Transaction[];
  try {
    data = await fetchTransactions(walletId, { ascending: true });
  } catch (error) {
    console.error('Failed to fetch transactions for export:', error);
    alert('Failed to export transactions.');
    return;
  }

  // Without names the export still works: authors then read "Unknown / N/A".
  const authors = await fetchAuthorNames().catch((error) => {
    console.error('Failed to fetch author names for export:', error);
    return {};
  });
  const csvContent = buildHistoryCsv(data, walletName, authors);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'treasury_report.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
