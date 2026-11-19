import { MAIN_ACCOUNTS, RESERVE_ACCOUNTS, type AccountId } from './accounts';
import { entryTitle, type Transaction } from './transaction';

export interface Period {
  start: string;
  end: string;
}

export type PeriodUnit = 'month' | 'quarter' | 'year';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const ymd = (d: Date) => `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function parseDate(date: string): Date | null {
  const m = DATE_PATTERN.exec(date);
  if (!m) return null;
  // Date.UTC maps years 0-99 to 1900-1999.
  const d = new Date(0);
  d.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return ymd(d) === date ? d : null;
}

function requireDate(date: string): Date {
  const d = parseDate(date);
  if (!d) throw new Error(`Not a date: ${date}`);
  return d;
}

const UNIT_MONTHS: Record<PeriodUnit, number> = { month: 1, quarter: 3, year: 12 };

/** Offset 0 runs from the unit's first day to `today`; other offsets are whole units. */
export function presetPeriod(unit: PeriodUnit, offset: number, today: string): Period {
  const now = requireDate(today);
  const length = UNIT_MONTHS[unit];
  const monthOfYear = now.getUTCMonth();
  const unitStartMonth = unit === 'year' ? 0 : monthOfYear - (monthOfYear % length);
  const first = new Date(Date.UTC(now.getUTCFullYear(), unitStartMonth + offset * length, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + length, 0));
  const start = ymd(first);
  const end = offset === 0 ? today : ymd(last);
  return { start, end };
}

export interface QuickPick {
  label: string;
  period: (today: string) => Period;
}

const quickPick = (label: string, unit: PeriodUnit, offset: number): QuickPick => ({
  label,
  period: (today) => presetPeriod(unit, offset, today),
});

export const QUICK_PICKS: QuickPick[] = [
  quickPick('This month', 'month', 0),
  quickPick('Last month', 'month', -1),
  quickPick('This quarter', 'quarter', 0),
  quickPick('Last quarter', 'quarter', -1),
  quickPick('This year', 'year', 0),
  quickPick('Last year', 'year', -1),
];

export function validatePeriod(period: Period): string | null {
  const start = parseDate(period.start);
  const end = parseDate(period.end);
  if (!start || !end) return 'Pick a start and an end date';
  if (start > end) return 'The start date must be on or before the end date';
  return null;
}

export const isSamePeriod = (a: Period, b: Period) => a.start === b.start && a.end === b.end;

export function periodDays(period: Period): number {
  return Math.round((requireDate(period.end).getTime() - requireDate(period.start).getTime()) / DAY_MS) + 1;
}

export const daysLabel = (days: number) => `${days} ${days === 1 ? 'day' : 'days'}`;

const monthName = (d: Date) => MONTHS[d.getUTCMonth()] ?? '';

/** "1–24 September 2026", "1 August – 24 September 2026", "1 December 2025 – 24 January 2026". */
export function periodLabel(period: Period): string {
  const start = requireDate(period.start);
  const end = requireDate(period.end);
  const [sd, ed] = [start.getUTCDate(), end.getUTCDate()];
  const [sy, ey] = [start.getUTCFullYear(), end.getUTCFullYear()];
  if (period.start === period.end) return `${ed} ${monthName(end)} ${ey}`;
  if (sy === ey && start.getUTCMonth() === end.getUTCMonth()) return `${sd}–${ed} ${monthName(end)} ${ey}`;
  if (sy === ey) return `${sd} ${monthName(start)} – ${ed} ${monthName(end)} ${ey}`;
  return `${sd} ${monthName(start)} ${sy} – ${ed} ${monthName(end)} ${ey}`;
}

/** "2026-09" when the period sits inside one calendar month, otherwise "start_end". */
export function periodKey(period: Period): string {
  if (period.start.slice(0, 7) === period.end.slice(0, 7)) return period.start.slice(0, 7);
  return `${period.start}_${period.end}`;
}

/** The whole calendar month before the one the period starts in. */
export function previousMonth(period: Period): Period {
  const start = requireDate(period.start);
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return { start: ymd(first), end: ymd(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0))) };
}

export const monthYearLabel = (period: Period) => {
  const start = requireDate(period.start);
  return `${monthName(start)} ${start.getUTCFullYear()}`;
};

/** "1 Sep". */
export function shortDate(date: string): string {
  const d = requireDate(date);
  return `${d.getUTCDate()} ${monthName(d).slice(0, 3)}`;
}

export const periodMonthName = (period: Period) => monthName(requireDate(period.start));

const toCents = (amount: number | string) => Math.round(Number(amount) * 100);

const MAIN_IDS = new Set<AccountId>(MAIN_ACCOUNTS.map((a) => a.id));
const RESERVE_IDS = new Set<AccountId>(RESERVE_ACCOUNTS.map((a) => a.id));

export interface EntryEffect {
  availableChange: number;
  reserveChange: number;
  moneyIn: number;
  moneyOut: number;
  /** Net sent from Available to the reserve; negative when it comes back. */
  movedToReserve: number;
}

export function entryEffect(tx: Transaction): EntryEffect {
  const cents = toCents(tx.amount);
  const legs: { account: AccountId; cents: number }[] =
    tx.type === 'outflow' ? [{ account: tx.account_id, cents: -cents }] : [{ account: tx.account_id, cents }];
  const source = tx.type === 'transfer' ? tx.from_account_id : null;
  if (source) legs.push({ account: source, cents: -cents });

  const sumOf = (ids: Set<AccountId>) => legs.reduce((s, l) => (ids.has(l.account) ? s + l.cents : s), 0);
  const availableChange = sumOf(MAIN_IDS);
  const reserveChange = sumOf(RESERVE_IDS);
  const crossesReserve = !!source && availableChange !== 0;
  const external = crossesReserve ? 0 : availableChange;
  return {
    availableChange,
    reserveChange,
    moneyIn: Math.max(external, 0),
    moneyOut: Math.max(-external, 0),
    movedToReserve: crossesReserve ? -availableChange : 0,
  };
}

export interface ReportEntry {
  entry: Transaction;
  title: string;
  removed: boolean;
  /** Position in the chronological order of the period, removed entries included. */
  order: number;
  availableChange: number;
  reserveChange: number;
  /** Balances after this entry; removed entries leave them as they were. */
  available: number;
  reserve: number;
}

export interface Report {
  period: Period;
  openingAvailable: number;
  openingReserve: number;
  closingAvailable: number;
  closingReserve: number;
  moneyIn: number;
  moneyOut: number;
  movedToReserve: number;
  entryCount: number;
  /** Chronological, live entries only. */
  entries: ReportEntry[];
  removedEntries: ReportEntry[];
}

const day = (tx: Transaction) => tx.date.slice(0, 10);

const byChronology = (a: Transaction, b: Transaction) =>
  a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/** All amounts are integer cents. */
export function buildReport(period: Period, transactions: Transaction[]): Report {
  const sorted = [...transactions].sort(byChronology);
  const live = (tx: Transaction) => !tx.deleted;
  const opening = sumEffects(sorted.filter((tx) => live(tx) && day(tx) < period.start));
  let available = opening.availableChange;
  let reserve = opening.reserveChange;
  const totals = { moneyIn: 0, moneyOut: 0, movedToReserve: 0 };
  const entries: ReportEntry[] = [];
  const removedEntries: ReportEntry[] = [];

  sorted
    .filter((tx) => day(tx) >= period.start && day(tx) <= period.end)
    .forEach((tx, order) => {
      const effect = entryEffect(tx);
      if (live(tx)) {
        available += effect.availableChange;
        reserve += effect.reserveChange;
        totals.moneyIn += effect.moneyIn;
        totals.moneyOut += effect.moneyOut;
        totals.movedToReserve += effect.movedToReserve;
      }
      const row: ReportEntry = {
        entry: tx,
        title: entryTitle(tx, 'Transaction'),
        removed: tx.deleted,
        order,
        availableChange: effect.availableChange,
        reserveChange: effect.reserveChange,
        available,
        reserve,
      };
      (tx.deleted ? removedEntries : entries).push(row);
    });

  return {
    period,
    openingAvailable: opening.availableChange,
    openingReserve: opening.reserveChange,
    closingAvailable: available,
    closingReserve: reserve,
    ...totals,
    entryCount: entries.length,
    entries,
    removedEntries,
  };
}

function sumEffects(transactions: Transaction[]) {
  return transactions.reduce(
    (sum, tx) => {
      const e = entryEffect(tx);
      return {
        availableChange: sum.availableChange + e.availableChange,
        reserveChange: sum.reserveChange + e.reserveChange,
      };
    },
    { availableChange: 0, reserveChange: 0 },
  );
}
