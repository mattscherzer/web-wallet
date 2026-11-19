import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';

export interface UnlockApi {
  openUnlock(): void;
  /** Keeps the idle-lock notice away until the returned release is called. */
  holdNotice(): () => void;
}

export const UnlockContext = createContext<UnlockApi>({ openUnlock: () => {}, holdNotice: () => () => {} });

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

/** A screen with nothing to change yet (loading, or failed to load) calls this so the idle-lock notice waits for real content. */
export function useHoldLockNotice() {
  const { holdNotice } = useContext(UnlockContext);
  useEffect(() => holdNotice(), [holdNotice]);
}
