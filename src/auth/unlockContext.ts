import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';

export interface UnlockApi {
  /** Opens the Unlock sheet (does nothing when the app is not locked). */
  openUnlock(): void;
}

/** Outside an UnlockProvider (isolated component tests) there is nothing to open. */
export const UnlockContext = createContext<UnlockApi>({ openUnlock: () => {} });

/**
 * The lock as seen by a screen. `requireUnlocked()` is the gate for anything that changes data: true when it may
 * go ahead, false after opening the Unlock sheet because the app is view only. It reads the lock when it is called,
 * not when the screen last rendered, so a gate reached after an await (a password box) still sees a lock made meanwhile.
 */
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
