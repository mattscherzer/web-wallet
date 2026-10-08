import { ACCOUNTS, getAccountLabel, type AccountId } from '../db/accounts';
import { formatSignedCurrency } from './formatCurrency';

export type RecordType = 'inflow' | 'outflow' | 'transfer';

/** The type names used in the address: /record?type=in */
export const TYPE_PARAMS: Record<string, RecordType> = {
  in: 'inflow',
  out: 'outflow',
  transfer: 'transfer',
};

export function typeParam(type: RecordType): string {
  return type === 'inflow' ? 'in' : type === 'outflow' ? 'out' : 'transfer';
}

export interface Category {
  id: string;
  label: string;
}

/** Per type, "Other" always last. */
export const CATEGORIES: Record<'inflow' | 'outflow', Category[]> = {
  inflow: [
    { id: '7th-tradition', label: '7th Tradition' },
    { id: 'literature', label: 'Literature sales' },
    { id: 'other', label: 'Other' },
  ],
  outflow: [
    { id: 'rent', label: 'Rent' },
    { id: 'literature', label: 'Literature purchases' },
    { id: 'donation', label: 'Donation to service' },
    { id: 'other', label: 'Other' },
  ],
};

/** Name for a stored category, including older entries that used free text. */
export function categoryLabel(id: string): string {
  const known = [...CATEGORIES.inflow, ...CATEGORIES.outflow].find((c) => c.id === id);
  if (known) return known.label;
  return id ? id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ') : '';
}

export interface RecordForm {
  type: RecordType;
  amount: string;
  /** Money in: into; money out: from; transfer: to. */
  accountId: AccountId;
  /** Transfer only: the source. */
  fromAccountId: AccountId;
  category: string;
  description: string;
  date: string;
}

export interface FieldError {
  field: 'amount' | 'accountId' | 'description' | 'date';
  message: string;
}

/** An amount typed with a point or a comma and up to two decimals; NaN when it isn't one. */
export function parseAmount(text: string): number {
  const t = text.trim().replace(/\s/g, '');
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return NaN;
  return Number(t.replace(',', '.'));
}

export function validateRecord(form: RecordForm): FieldError[] {
  const errors: FieldError[] = [];
  const amount = parseAmount(form.amount);
  if (!(amount > 0)) errors.push({ field: 'amount', message: 'Enter an amount above zero' });
  if (form.type === 'transfer' && form.accountId === form.fromAccountId) {
    errors.push({ field: 'accountId', message: 'Choose two different accounts' });
  }
  if (!form.description.trim()) {
    if (form.type === 'outflow') {
      errors.push({ field: 'description', message: 'Say who was paid or what it was for' });
    } else if (form.type === 'inflow' && form.category === 'other') {
      errors.push({ field: 'description', message: 'Say what this was for' });
    }
  }
  if (!form.date) errors.push({ field: 'date', message: 'Choose a date' });
  return errors;
}

const isReserve = (id: AccountId) => ACCOUNTS.find((a) => a.id === id)?.isReserve === true;

/** How an entry changes the Available balance (operating accounts only). */
export function availableDelta(entry: {
  type: RecordType;
  amount: number;
  accountId: AccountId;
  fromAccountId?: AccountId | null;
}): number {
  const { type, amount, accountId, fromAccountId } = entry;
  if (type === 'inflow') return isReserve(accountId) ? 0 : amount;
  if (type === 'outflow') return isReserve(accountId) ? 0 : -amount;
  const gained = isReserve(accountId) ? 0 : amount;
  const lost = fromAccountId && !isReserve(fromAccountId) ? amount : 0;
  return gained - lost;
}

export interface RecordPreview {
  lines: { accountId: AccountId; after: number }[];
  availableAfter: number;
}

/** Account and Available balances as they will be once the entry is saved. */
export function recordPreview(form: RecordForm, balances: Record<AccountId, number>): RecordPreview {
  const parsed = parseAmount(form.amount);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  const lines: RecordPreview['lines'] =
    form.type === 'inflow'
      ? [{ accountId: form.accountId, after: balances[form.accountId] + amount }]
      : form.type === 'outflow'
        ? [{ accountId: form.accountId, after: balances[form.accountId] - amount }]
        : [
            { accountId: form.fromAccountId, after: balances[form.fromAccountId] - amount },
            { accountId: form.accountId, after: balances[form.accountId] + amount },
          ];
  const available = ACCOUNTS.filter((a) => !a.isReserve).reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);
  const delta = availableDelta({ type: form.type, amount, accountId: form.accountId, fromAccountId: form.fromAccountId });
  return { lines, availableAfter: available + delta };
}

/** The primary button states the action: "Record −€60.00 from Bank Account". */
export function recordActionLabel(form: RecordForm, locale?: string): string {
  const amount = parseAmount(form.amount);
  if (!(amount > 0)) return 'Record';
  const money = formatSignedCurrency(amount, form.type, locale);
  const to = getAccountLabel(form.accountId);
  if (form.type === 'inflow') return `Record ${money} into ${to}`;
  if (form.type === 'outflow') return `Record ${money} from ${to}`;
  return `Record ${money} from ${getAccountLabel(form.fromAccountId)} to ${to}`;
}

/** The row to save for a valid form. */
export function toTransactionInput(form: RecordForm, walletId: string) {
  const description = form.description.trim();
  const base = {
    wallet_id: walletId,
    amount: parseAmount(form.amount),
    date: form.date,
    account_id: form.accountId,
    notes: description,
  };
  if (form.type === 'transfer') {
    return { ...base, type: 'transfer' as const, from_account_id: form.fromAccountId, category: 'transfer', reason: null };
  }
  return {
    ...base,
    type: form.type,
    from_account_id: null,
    category: form.category,
    reason: form.category === 'other' ? description : null,
  };
}
