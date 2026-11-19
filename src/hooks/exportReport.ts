import { fetchReportTransactions } from '../db/queries';
import { buildReport, type Period } from '../domain/reports';
import { buildReportCsv, reportFilename } from '../domain/reportCsv';
import { downloadTextFile } from '../platform/download';

export async function exportReport(walletId: string, walletName: string, period: Period, includeRemoved: boolean) {
  let report;
  try {
    report = buildReport(period, await fetchReportTransactions(walletId));
  } catch (error) {
    console.error('Failed to fetch transactions for the report export:', error);
    throw error;
  }

  downloadTextFile(
    reportFilename(walletName, report),
    buildReportCsv(report, walletName, includeRemoved),
    'text/csv;charset=utf-8;',
  );
}
