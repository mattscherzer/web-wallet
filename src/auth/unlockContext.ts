import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';

export interface UnlockApi {
  openUnlock(): void;
}

export const UnlockContext = createContext<UnlockApi>({ openUnlock: () => {} });

/** `requireUnlocked()` reads the lock when called, so a gate reached after an await still sees a lock made meanwhile. */
export function useUnlock() {
  const { locked } = useAuth();
  const { openUnlock } = useContext(UnlockContext);
  const now = useRef(locked);
  useEffect(() => {
    now.current = locked;
  });
  return useMemo(
    () => ({
      locked,
      openUnlock,
      requireUnlocked: () => {
        if (!now.current) return true;
        openUnlock();
        return false;
      },
    }),
    [locked, openUnlock],
  );
}
