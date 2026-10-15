import { useEffect, useRef } from 'react';

/** The app locks after this long without use. */
export const IDLE_LOCK_MS = 30 * 60_000;

/** When the app was last used, kept so a closed or reloaded app still locks after 30 minutes. */
export const LAST_ACTIVITY_KEY = 'treasury.lastActivity';

export function rememberActivity(now = Date.now()) {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {
    // Storage blocked: the lock then only covers an app that stays open.
  }
}

/** True when the app was last used more than 30 minutes ago (never used before counts as not expired). */
export function idleExpired(now = Date.now()): boolean {
  try {
    const last = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    return last > 0 && now - last >= IDLE_LOCK_MS;
  } catch {
    return false;
  }
}

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
    rememberActivity(lastActivity.current);
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
      const now = Date.now();
      // Written at most every few seconds: storage writes on every scroll or key press would be wasteful.
      if (now - lastActivity.current > 5_000) rememberActivity(now);
      lastActivity.current = now;
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
