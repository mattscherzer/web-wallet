import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './useAuth';

export interface UnlockApi {
  /** Opens the Unlock sheet (does nothing when the app is not locked). */
  openUnlock(): void;
}

/** Outside an UnlockProvider (isolated component tests) there is nothing to open. */
export const UnlockContext = createContext<UnlockApi>({ openUnlock: () => {} });

/**
 * The lock as seen by a screen. `requireUnlocked()` is the gate for anything that changes data: true when it may
 * go ahead, false after opening the Unlock sheet because the app is view only.
 */
export function useUnlock() {
  const { locked } = useAuth();
  const { openUnlock } = useContext(UnlockContext);
  return useMemo(
    () => ({
      locked,
      openUnlock,
      requireUnlocked: () => {
        if (!locked) return true;
        openUnlock();
        return false;
      },
    }),
    [locked, openUnlock],
  );
}
