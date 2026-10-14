// Logic of the admin-create-user edge function, free of Deno/Supabase imports so it can be unit-tested.

export interface Caller {
  id: string;
  isAdmin: boolean;
}

export interface CreateUserDeps {
  /** Resolve a bearer token to the logged-in user, or null when it is missing, invalid or expired. */
  getCaller(token: string): Promise<Caller | null>;
  createUser(input: { email: string; password: string; displayName: string }): Promise<{ id: string } | { error: 'duplicate' | 'failed' }>;
  addMemberships(userId: string, walletIds: string[]): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_PASSWORD = 8;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export async function handleCreateUser(req: Request, deps: CreateUserDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  const caller = token ? await deps.getCaller(token) : null;
  if (!caller) return reply(401, { error: 'Not logged in' });
  if (!caller.isAdmin) return reply(403, { error: 'Admins only' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply(400, { error: 'Invalid request' });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const walletIds = Array.isArray(body.walletIds) ? body.walletIds.filter((w): w is string => typeof w === 'string') : [];
  if (!EMAIL.test(email)) return reply(400, { error: 'Enter a valid email address' });
  if (password.length < MIN_PASSWORD) return reply(400, { error: `Password needs at least ${MIN_PASSWORD} characters` });
  if (!displayName) return reply(400, { error: 'Enter a display name' });

  const created = await deps.createUser({ email, password, displayName });
  if ('error' in created) {
    return created.error === 'duplicate'
      ? reply(409, { error: 'A user with that email already exists' })
      : reply(500, { error: 'Could not create the user' });
  }

  try {
    if (walletIds.length > 0) await deps.addMemberships(created.id, walletIds);
  } catch {
    await deps.deleteUser(created.id).catch(() => {});
    return reply(500, { error: 'Could not give the user their wallets; nothing was created' });
  }
  return reply(200, { id: created.id });
}
