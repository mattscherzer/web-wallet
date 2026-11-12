import { supabase } from './supabase';

export interface StaffSession {
  access_token: string;
  refresh_token: string;
  user?: { id?: string };
}

/**
 * What a PIN check came to: `wrong` (the server refused the username or PIN), `paused` (too many wrong tries, wait
 * `retryAfter` seconds) or `error` (the server could not be reached or failed: not the person's mistake).
 */
type Refused =
  { ok: false; kind: 'wrong' } | { ok: false; kind: 'paused'; retryAfter: number } | { ok: false; kind: 'error' };
export type StaffLoginResult = { ok: true; session: StaffSession } | Refused;
export type StaffCheckResult = { ok: true; userId: string } | Refused;

const WRONG = 'Wrong username or PIN';

/** Calls `staff-login` and sorts a refusal into wrong / paused / error. `data` is the body of a success. */
async function askStaffLogin(body: Record<string, unknown>): Promise<{ data: unknown } | Refused> {
  const { data, error } = await supabase.functions.invoke('staff-login', { body });
  if (!error) return { data };
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    try {
      const json = (await response.clone().json()) as { error?: string; retryAfter?: number };
      if (json.error === 'locked') return { ok: false, kind: 'paused', retryAfter: Math.max(1, json.retryAfter ?? 60) };
      if (response.status === 401 || json.error === WRONG) return { ok: false, kind: 'wrong' };
    } catch {
      // not JSON: treat as a server failure
    }
    return { ok: false, kind: 'error' };
  }
  return (error as { message?: string }).message === WRONG
    ? { ok: false, kind: 'wrong' }
    : { ok: false, kind: 'error' };
}

export async function requestStaffLogin(username: string, pin: string): Promise<StaffLoginResult> {
  const answer = await askStaffLogin({ username, pin });
  if (!('data' in answer)) return answer;
  const session = (answer.data as { session?: StaffSession } | null)?.session;
  if (!session?.access_token || !session.refresh_token) return { ok: false, kind: 'error' };
  return { ok: true, session };
}

/** Checks a username and PIN and says whose they are, without starting a session (used to unlock). */
export async function checkStaffPin(username: string, pin: string): Promise<StaffCheckResult> {
  const answer = await askStaffLogin({ username, pin, verifyOnly: true });
  if (!('data' in answer)) return answer;
  const userId = (answer.data as { userId?: string } | null)?.userId;
  return userId ? { ok: true, userId } : { ok: false, kind: 'error' };
}
