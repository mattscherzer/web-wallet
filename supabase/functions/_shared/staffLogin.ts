import { CORS_HEADERS, isPin, reply } from './http.ts';

export interface AttemptState {
  userId: string | null;
  pinHash: string | null;
  disabled: boolean;
  locked: boolean;
  retryAfter: number;
}

export interface StaffLoginDeps {
  beginAttempt(username: string): Promise<AttemptState>;
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

    const reset = deps.resetAttempts(username);
    if (body.verifyOnly === true) {
      await reset;
      return reply(200, { userId: state.userId });
    }
    const [, session] = await Promise.all([reset, deps.mintSession(state.userId)]);
    return reply(200, { session });
  } catch (error) {
    console.error('staff-login failed', error);
    return reply(500, { error: 'Something went wrong. Try again.' });
  }
}
