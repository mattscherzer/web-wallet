import { supabase } from '../db/supabase';

/** The staff username used last on this device: sign-in prefills it and unlock re-checks that person's PIN. */
export const LAST_STAFF_KEY = 'treasury.lastStaffUsername';

export function readLastStaff(): string {
  try {
    return window.localStorage.getItem(LAST_STAFF_KEY) ?? '';
  } catch {
    return '';
  }
}

export function forgetStaff() {
  try {
    window.localStorage.removeItem(LAST_STAFF_KEY);
  } catch {
    // Storage blocked: nothing was remembered anyway.
  }
}

export function rememberStaff(username: string) {
  try {
    window.localStorage.setItem(LAST_STAFF_KEY, username);
  } catch {
    // Storage blocked: the username just isn't remembered.
  }
}

export interface StaffSession {
  access_token: string;
  refresh_token: string;
  user?: { id?: string };
}

/**
 * What a PIN check came to: `wrong` (the server refused the username or PIN), `paused` (too many wrong tries, wait
 * `retryAfter` seconds) or `error` (the server could not be reached or failed: not the person's mistake).
 */
export type StaffLoginResult =
  | { ok: true; session: StaffSession }
  | { ok: false; kind: 'wrong' }
  | { ok: false; kind: 'paused'; retryAfter: number }
  | { ok: false; kind: 'error' };

const WRONG = 'Wrong username or PIN';

/** Asks the `staff-login` edge function to check a username and PIN. */
export async function requestStaffLogin(username: string, pin: string): Promise<StaffLoginResult> {
  const { data, error } = await supabase.functions.invoke('staff-login', { body: { username, pin } });
  if (error) {
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const body = (await response.clone().json()) as { error?: string; retryAfter?: number };
        if (body.error === 'locked') return { ok: false, kind: 'paused', retryAfter: Math.max(1, body.retryAfter ?? 60) };
        if (response.status === 401 || body.error === WRONG) return { ok: false, kind: 'wrong' };
      } catch {
        // not JSON: treat as a server failure
      }
      return { ok: false, kind: 'error' };
    }
    return (error as { message?: string }).message === WRONG ? { ok: false, kind: 'wrong' } : { ok: false, kind: 'error' };
  }
  const session = (data as { session?: StaffSession } | null)?.session;
  if (!session?.access_token || !session.refresh_token) return { ok: false, kind: 'error' };
  return { ok: true, session };
}
