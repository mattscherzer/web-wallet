import { createTransaction, removeTransaction, restoreTransaction, updateTransaction } from '../db/transactions';
import { toTransactionInput, type RecordForm } from '../domain/recordForm';
import { useWallet } from '../wallet/useWallet';
import { useAuth } from '../auth/useAuth';

type Updates = Parameters<typeof updateTransaction>[1];

/** The write commands for the open wallet, signed with the name of whoever is logged in. Each rejects when no wallet is open. */
export function useTransactionCommands() {
  const { current } = useWallet();
  const actor = useAuth().profile?.displayName;
  const walletId = () => {
    if (!current) throw new Error('No wallet is open');
    return current.id;
  };
  return {
    create: async (form: RecordForm) => createTransaction(toTransactionInput(form, walletId()), actor),
    update: async (id: string, updates: Updates, reason: string) =>
      updateTransaction(id, updates, { walletId: walletId(), reason, actor }),
    remove: async (id: string, reason: string, note?: string) =>
      removeTransaction(id, { walletId: walletId(), reason, note, actor }),
    restore: async (id: string) => restoreTransaction(id, { walletId: walletId(), actor }),
  };
}
