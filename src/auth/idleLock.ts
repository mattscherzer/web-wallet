import { useEffect, useRef } from 'react';
import { safeStorage } from '../platform/storage';

export const IDLE_LOCK_MS = 30 * 60_000;

export const LAST_ACTIVITY_KEY = 'treasury.lastActivity';

export function rememberActivity(now = Date.now()) {
  safeStorage.setItem(LAST_ACTIVITY_KEY, String(now));
}

export function idleExpired(now = Date.now()): boolean {
  const last = Number(safeStorage.getItem(LAST_ACTIVITY_KEY));
  return last > 0 && now - last >= IDLE_LOCK_MS;
}

const LOCKED_KEY = 'treasury.locked';
export type LockReason = 'manual' | 'idle';

export function readLock(): LockReason | null {
  const v = safeStorage.getItem(LOCKED_KEY);
  return v === 'manual' || v === 'idle' ? v : null;
}

export function writeLock(reason: LockReason | null) {
  if (reason) safeStorage.setItem(LOCKED_KEY, reason);
  else safeStorage.removeItem(LOCKED_KEY);
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

export function useIdleLock(active: boolean, onLock: () => void) {
  const lastActivity = useRef(0);
  const lastWrite = useRef(0);
  const lock = useRef(onLock);
  useEffect(() => {
    lock.current = onLock;
  });

  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();
    rememberActivity(lastActivity.current);
    lastWrite.current = lastActivity.current;
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
      if (now - lastWrite.current > 5_000) {
        rememberActivity(now);
        lastWrite.current = now;
      }
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
