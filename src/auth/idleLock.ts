import { useEffect, useRef } from 'react';

/** The app locks after this long without use. */
export const IDLE_LOCK_MS = 30 * 60_000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Calls `onLock` once the person has not used the app for IDLE_LOCK_MS. A phone that sleeps pauses timers, so the
 * time is also checked against the clock whenever the app becomes visible again.
 */
export function useIdleLock(active: boolean, onLock: () => void) {
  const lastActivity = useRef(0);
  const lock = useRef(onLock);
  useEffect(() => {
    lock.current = onLock;
  });

  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const check = () => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LOCK_MS) {
        lock.current();
        return;
      }
      timer = setTimeout(check, IDLE_LOCK_MS - idle);
    };
    timer = setTimeout(check, IDLE_LOCK_MS);

    const touch = () => {
      lastActivity.current = Date.now();
    };
    const onVisible = () => {
      if (document.visibilityState !== 'hidden' && Date.now() - lastActivity.current >= IDLE_LOCK_MS) lock.current();
    };
    for (const e of ACTIVITY_EVENTS) document.addEventListener(e, touch, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      for (const e of ACTIVITY_EVENTS) document.removeEventListener(e, touch, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active]);
}
