import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Snackbar from '../components/Snackbar';
import UnlockSheet from './UnlockSheet';
import { UnlockContext, type UnlockApi } from './unlockContext';
import { useAuth } from './useAuth';

/** Owns the Unlock sheet and the "locked after 30 minutes" notice, for everything below it. */
export function UnlockProvider({ children }: { children: ReactNode }) {
  const { locked, lockedByIdle } = useAuth();
  const [open, setOpen] = useState(false);
  const openUnlock = useCallback(() => setOpen(true), []);
  const api = useMemo<UnlockApi>(() => ({ openUnlock }), [openUnlock]);
  const asking = open && locked;
  return (
    <UnlockContext.Provider value={api}>
      {children}
      {locked && lockedByIdle && !asking && (
        <Snackbar message="Locked after 30 minutes without use" actionLabel="Unlock" onAction={openUnlock} />
      )}
      {asking && <UnlockSheet onClose={() => setOpen(false)} />}
    </UnlockContext.Provider>
  );
}
