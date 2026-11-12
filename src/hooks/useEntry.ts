import type { AuditEntry, Transaction } from '../domain/transaction';
import { fetchAuditLog, fetchTransaction } from '../db/queries';
import { useWalletQuery } from './useWalletQuery';

export type EntryStatus = 'loading' | 'ready' | 'missing' | 'error';

/** An entry (removed or not) and its history. `refresh` re-reads both after a change. */
export function useEntry(id: string) {
  const { data, loaded, failed, refresh } = useWalletQuery<{
    tx: Transaction | null;
    audit: AuditEntry[];
  } | null>(
    async (walletId) => {
      const tx = await fetchTransaction(walletId, id);
      return { tx, audit: tx ? await fetchAuditLog(walletId, id) : [] };
    },
    [id],
    null,
    'transactions',
  );
  const status: EntryStatus = failed ? 'error' : !loaded || !data ? 'loading' : data.tx ? 'ready' : 'missing';
  return { status, tx: data?.tx ?? null, audit: data?.audit ?? [], refresh };
}
