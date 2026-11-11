import { MAIN_ACCOUNTS, RESERVE_ACCOUNTS } from './accounts';
import type { Transaction } from './transaction';
import { authorLabel } from './authorLabel';

export const HISTORY_CSV_HEADER = ['Date', 'In', 'Out', 'What', 'Balance', 'Prudent Reserve', 'Created by'];

interface MoneyEffect {
  displayIn: string;
  displayOut: string;
  mainDelta: number;
  reserveDelta: number;
}

const inMain = (id?: string | null) => !!id && MAIN_ACCOUNTS.some((a) => a.id === id);
const inReserve = (id?: string | null) => !!id && RESERVE_ACCOUNTS.some((a) => a.id === id);

const NO_EFFECT: MoneyEffect = { displayIn: '', displayOut: '', mainDelta: 0, reserveDelta: 0 };

function transferEffect(tx: Transaction): MoneyEffect | null {
  const isMainDest = inMain(tx.account_id);
  const isReserveDest = inReserve(tx.account_id);
  const isMainSrc = inMain(tx.from_account_id);
  const isReserveSrc = inReserve(tx.from_account_id);
  const shown = tx.amount.toFixed(2);

  if (isMainSrc && isReserveDest) {
    return { ...NO_EFFECT, displayOut: shown, mainDelta: -tx.amount, reserveDelta: tx.amount };
  }
  if (isReserveSrc && isMainDest) {
    return { ...NO_EFFECT, displayIn: shown, mainDelta: tx.amount, reserveDelta: -tx.amount };
  }
  // Internal transfers don't change the totals, so the export leaves them out.
  if ((isMainSrc && isMainDest) || (isReserveSrc && isReserveDest)) return null;
  return NO_EFFECT;
}

/** Which column the amount goes in and how it moves the balances; null for transfers within main or within reserve. */
function moneyEffect(tx: Transaction): MoneyEffect | null {
  if (tx.type === 'transfer') return transferEffect(tx);
  if (tx.type !== 'inflow' && tx.type !== 'outflow') return NO_EFFECT;

  const isMainDest = inMain(tx.account_id);
  const isReserveDest = inReserve(tx.account_id);
  const sign = tx.type === 'inflow' ? 1 : -1;
  const shown = isMainDest || isReserveDest ? tx.amount.toFixed(2) : '';
  return {
    displayIn: sign > 0 ? shown : '',
    displayOut: sign > 0 ? '' : shown,
    mainDelta: isMainDest ? sign * tx.amount : 0,
    reserveDelta: isReserveDest ? sign * tx.amount : 0,
  };
}

function whatText(tx: Transaction): string {
  let what = tx.category
    ? tx.category.charAt(0).toUpperCase() + tx.category.slice(1).replace(/-/g, ' ')
    : 'Transaction';
  if (!tx.notes) return what;
  if (tx.category && tx.category !== 'other' && tx.category !== 'transfer') what += ` - ${tx.notes}`;
  else what = tx.notes;
  return what;
}

function shortDate(date: string): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = String(d.getUTCFullYear()).slice(2);
  return `${day}.${month}.${year}`;
}

const quoted = (text: string) => `"${text.replace(/"/g, '""')}"`;

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
    const effect = moneyEffect(tx);
    if (!effect) continue;

    mainBalance += effect.mainDelta;
    reserveBalance += effect.reserveDelta;

    rows.push([
      shortDate(tx.date),
      effect.displayIn,
      effect.displayOut,
      quoted(whatText(tx)),
      mainBalance.toFixed(2),
      `+${reserveBalance.toFixed(2)}`,
      quoted(authorLabel(tx)),
    ]);
  }

  return rows;
}

/** With a wallet name, the file opens with a `Wallet,"<name>"` line above the column header. */
export function buildHistoryCsv(transactions: Transaction[], walletName?: string): string {
  const lines = buildHistoryCsvRows(transactions).map((e) => e.join(','));
  if (walletName) lines.unshift(`Wallet,"${walletName.replace(/"/g, '""')}"`);
  return lines.join('\n');
}
