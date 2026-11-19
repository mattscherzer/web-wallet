import { csvText, quoted, whatText } from './csvCells';
import { authorLabel } from './authorLabel';
import { entryEffect, periodKey, type Report, type ReportEntry } from './reports';

export const REPORT_CSV_HEADER = [
  'Date',
  'Description',
  'Money in',
  'Money out',
  'Moved to reserve',
  'Available balance',
  'Reserve balance',
  'Created by',
];

const money = (cents: number) => (cents / 100).toFixed(2);
const optionalMoney = (cents: number) => (cents === 0 ? '' : money(cents));

function entryRow(row: ReportEntry): string[] {
  const effect = entryEffect(row.entry);
  const description = whatText(row.entry);
  return [
    row.entry.date,
    csvText(row.removed ? `Removed: ${description}` : description),
    optionalMoney(effect.moneyIn),
    optionalMoney(effect.moneyOut),
    optionalMoney(effect.movedToReserve),
    money(row.available),
    money(row.reserve),
    csvText(authorLabel(row.entry)),
  ];
}

/** Totals are the report's own, so Available opening + in - out - moved = closing. */
export function buildReportCsv(report: Report, walletName: string, includeRemoved = false): string {
  const shown = includeRemoved
    ? [...report.entries, ...report.removedEntries].sort((a, b) => a.order - b.order)
    : report.entries;

  const lines = [
    ['Wallet', csvText(walletName)],
    ['Period', `${report.period.start} to ${report.period.end}`],
    REPORT_CSV_HEADER,
    [
      report.period.start,
      quoted('Opening balance'),
      '',
      '',
      '',
      money(report.openingAvailable),
      money(report.openingReserve),
      '',
    ],
    ...shown.map(entryRow),
    [
      '',
      quoted('Totals'),
      money(report.moneyIn),
      money(report.moneyOut),
      money(report.movedToReserve),
      money(report.closingAvailable),
      money(report.closingReserve),
      '',
    ],
  ];
  return lines.map((cells) => cells.join(',')).join('\n');
}

const MAX_SLUG = 40;

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
  return slug || 'wallet';
}

export const reportFilename = (walletName: string, report: Pick<Report, 'period'>) =>
  `${slugify(walletName)}_${periodKey(report.period)}.csv`;
