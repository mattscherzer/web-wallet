import { useState } from 'react';
import { useOwnerConfirm } from './OwnerConfirm';
import { UserMessageError } from '../domain/userMessageError';
import { couldnt } from '../utils/copy';

export function useOwnerAction(run: () => Promise<void>, onDone: () => Promise<void>) {
  const confirmOwner = useOwnerConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (await confirmOwner()) {
        await run();
        await onDone();
      }
    } catch (err) {
      setError(err instanceof UserMessageError ? err.message : couldnt('do that'));
    }
    setBusy(false);
  };
  return { error, setError, busy, go };
}
