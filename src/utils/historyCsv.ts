import { MAIN_ACCOUNTS, RESERVE_ACCOUNTS } from '../db/accounts';
import type { Transaction } from '../db/database';

export const HISTORY_CSV_HEADER = ['Date', 'In', 'Out', 'What', 'Balance', 'Prudent Reserve'];

/**
 * Rows for the treasury report, header first. Expects transactions in
 * chronological order; running balances are split into main vs. reserve.
 */
export function buildHistoryCsvRows(transactions: Transaction[]): string[][] {
  let mainBalance = 0;
  let reserveBalance = 0;

  const rows = [HISTORY_CSV_HEADER];

  for (const tx of transactions) {
    if (tx.deleted) continue;

    const isMainDest = MAIN_ACCOUNTS.some((a) => a.id === tx.account_id);
    const isReserveDest = RESERVE_ACCOUNTS.some((a) => a.id === tx.account_id);

    const isMainSrc = tx.from_account_id
      ? MAIN_ACCOUNTS.some((a) => a.id === tx.from_account_id)
      : false;
    const isReserveSrc = tx.from_account_id
      ? RESERVE_ACCOUNTS.some((a) => a.id === tx.from_account_id)
      : false;

    let displayIn = '';
    let displayOut = '';

    if (tx.type === 'inflow') {
      if (isMainDest) {
        mainBalance += tx.amount;
        displayIn = tx.amount.toFixed(2);
      }
      if (isReserveDest) {
        reserveBalance += tx.amount;
        if (!isMainDest) displayIn = tx.amount.toFixed(2);
      }
    } else if (tx.type === 'outflow') {
      if (isMainDest) {
        mainBalance -= tx.amount;
        displayOut = tx.amount.toFixed(2);
      }
      if (isReserveDest) {
        reserveBalance -= tx.amount;
        if (!isMainDest) displayOut = tx.amount.toFixed(2);
      }
    } else if (tx.type === 'transfer') {
      if (isMainSrc && isReserveDest) {
        mainBalance -= tx.amount;
        reserveBalance += tx.amount;
        displayOut = tx.amount.toFixed(2); // Leaving main balance
      } else if (isReserveSrc && isMainDest) {
        reserveBalance -= tx.amount;
        mainBalance += tx.amount;
        displayIn = tx.amount.toFixed(2); // Entering main balance
      } else if (isMainSrc && isMainDest) {
        // Internal transfer between main accounts. Don't show in/out to keep total consistent.
        // Skip it entirely from the export because we only care about total amount.
        continue;
      } else if (isReserveSrc && isReserveDest) {
        // Internal transfer between reserve accounts.
        continue;
      }
    }

    let what = tx.category
      ? tx.category.charAt(0).toUpperCase() + tx.category.slice(1).replace(/-/g, ' ')
      : 'Transaction';

    if (tx.notes) {
      if (tx.category && tx.category !== 'other' && tx.category !== 'transfer') {
        what += ` - ${tx.notes}`;
      } else {
        what = tx.notes;
      }
    }

    // Format date as DD.MM.YY
    const d = new Date(tx.date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = String(d.getUTCFullYear()).slice(2);
    const dateStr = `${day}.${month}.${year}`;

    const whatStr = `"${what.replace(/"/g, '""')}"`;

    rows.push([
      dateStr,
      displayIn,
      displayOut,
      whatStr,
      mainBalance.toFixed(2),
      `+${reserveBalance.toFixed(2)}`,
    ]);
  }

  return rows;
}

export function buildHistoryCsv(transactions: Transaction[]): string {
  return buildHistoryCsvRows(transactions)
    .map((e) => e.join(','))
    .join('\n');
}
