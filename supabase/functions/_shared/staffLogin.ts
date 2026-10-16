// Logic of the staff-login edge function, free of Deno/Supabase imports so it can be unit-tested.
import { CORS_HEADERS, isPin, reply } from './http.ts';

export interface AttemptState {
  userId: string | null;
  pinHash: string | null;
  disabled: boolean;
  /** This try is refused outright because a wait is still running (nothing was counted). */
  locked: boolean;
  retryAfter: number;
}

export interface StaffLoginDeps {
  /** Counts this try atomically and returns what is known about the username (unknown names are counted too). */
  beginAttempt(username: string): Promise<AttemptState>;
  /** Compares the PIN with the hash. With no hash it must still do the same work (no timing tell), then answer false. */
  verifyPin(pin: string, hash: string | null): Promise<boolean>;
  resetAttempts(username: string): Promise<void>;
  mintSession(userId: string): Promise<Record<string, unknown>>;
}

const REFUSED = { error: 'Wrong username or PIN' };

export async function handleStaffLogin(req: Request, deps: StaffLoginDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply(401, REFUSED);
  }
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!username || username.length > 40 || !isPin(body.pin)) return reply(401, REFUSED);

  try {
    const state = await deps.beginAttempt(username);
    if (state.locked) return reply(429, { error: 'locked', retryAfter: state.retryAfter });

    const pinOk = await deps.verifyPin(body.pin, state.pinHash);
    if (!pinOk || !state.userId || state.disabled) return reply(401, REFUSED);

    await deps.resetAttempts(username);
    // Unlocking an app that is already signed in only needs to know who the PIN belongs to: no new session.
    if (body.verifyOnly === true) return reply(200, { userId: state.userId });
    return reply(200, { session: await deps.mintSession(state.userId) });
  } catch (error) {
    console.error('staff-login failed', error);
    return reply(500, { error: 'Something went wrong. Try again.' });
  }
}
