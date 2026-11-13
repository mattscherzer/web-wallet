import { useState } from 'react';
import { useOwnerConfirm } from './OwnerConfirm';
import { couldnt } from '../utils/copy';

/** Runs an owner action: asks for the password first (once per 15 minutes), shows what went wrong. */
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
      setError(err instanceof Error ? err.message : couldnt('do that'));
    }
    setBusy(false);
  };
  return { error, setError, busy, go };
}
