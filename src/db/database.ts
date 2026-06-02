import Dexie, { type EntityTable } from 'dexie';

// ─── Types ──────────────────────────────────────────────
export type AccountId = 'cash' | 'paypal' | 'bank';
export type TransactionType = 'inflow' | 'outflow';
export type AuditAction = 'create' | 'update' | 'delete';

export interface Account {
  id: AccountId;
  name: string;
  icon: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;            // ISO date string (YYYY-MM-DD)
  accountId: AccountId;
  category: string;
  notes: string;
  collectionPeriod?: { start: string; end: string };
  reason?: string;         // custom reason text for "Other"
  createdAt: string;       // ISO datetime
  updatedAt: string;       // ISO datetime
  deleted: boolean;
}

export interface AuditEntry {
  id: string;
  transactionId: string;
  action: AuditAction;
  timestamp: string;       // ISO datetime
  previousData?: Partial<Transaction>;
  newData?: Partial<Transaction>;
}

// ─── Database ───────────────────────────────────────────
const db = new Dexie('TreasuryWallet') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  auditLog: EntityTable<AuditEntry, 'id'>;
};

db.version(1).stores({
  transactions: 'id, type, date, accountId, category, deleted',
  auditLog: 'id, transactionId, action, timestamp',
});

export { db };

// ─── Static Account Data ────────────────────────────────
export const ACCOUNTS: Account[] = [
  { id: 'cash', name: 'Cash Balance', icon: 'wallet' },
  { id: 'paypal', name: 'PayPal Balance', icon: 'credit-card' },
  { id: 'bank', name: 'Bank Account', icon: 'landmark' },
];

// ─── Helper: Generate UUID ──────────────────────────────
export function generateId(): string {
  return crypto.randomUUID();
}

// ─── Helper: Create Transaction ─────────────────────────
export async function createTransaction(
  data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>
): Promise<string> {
  const id = generateId();
  const now = new Date().toISOString();
  const transaction: Transaction = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };

  await db.transactions.add(transaction);

  // Audit log
  await db.auditLog.add({
    id: generateId(),
    transactionId: id,
    action: 'create',
    timestamp: now,
    newData: transaction,
  });

  return id;
}

// ─── Helper: Update Transaction ─────────────────────────
export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'createdAt' | 'deleted'>>
): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing) throw new Error('Transaction not found');

  const now = new Date().toISOString();
  const newData = { ...updates, updatedAt: now };

  await db.transactions.update(id, newData);

  await db.auditLog.add({
    id: generateId(),
    transactionId: id,
    action: 'update',
    timestamp: now,
    previousData: existing,
    newData: { ...existing, ...newData },
  });
}

// ─── Helper: Soft-Delete Transaction ────────────────────
export async function deleteTransaction(id: string): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing) throw new Error('Transaction not found');

  const now = new Date().toISOString();
  await db.transactions.update(id, { deleted: true, updatedAt: now });

  await db.auditLog.add({
    id: generateId(),
    transactionId: id,
    action: 'delete',
    timestamp: now,
    previousData: existing,
  });
}
