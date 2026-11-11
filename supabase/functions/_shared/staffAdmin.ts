// Logic of the staff-admin edge function (owners manage staff), free of Deno/Supabase imports so it can be unit-tested.
import { CORS_HEADERS, isPin, reply } from './http.ts';

export interface StaffListEntry {
  user_id: string;
  username: string;
  display_name: string;
  wallet_id: string;
  disabled: boolean;
}

export interface StaffAdminDeps {
  /** Resolve a bearer token to the logged-in user, or null when it is missing, invalid or expired. */
  getCaller(token: string): Promise<{ id: string } | null>;
  /** The caller's role in that wallet, or null when they are not a member. */
  roleIn(userId: string, walletId: string): Promise<'owner' | 'staff' | null>;
  /** The membership of a user (any wallet), or null for an unknown user. */
  getMember(userId: string): Promise<{ userId: string; walletId: string; role: 'owner' | 'staff' } | null>;
  usernameTaken(username: string): Promise<boolean>;
  hashPin(pin: string): Promise<string>;
  /** Creates the login (random password nobody keeps, no personal data) and returns its id. */
  createAuthUser(displayName: string): Promise<string>;
  /** Adds the membership and the PIN row for a freshly created login. */
  addStaff(input: { userId: string; walletId: string; username: string; pinHash: string }): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
  setPinHash(userId: string, pinHash: string): Promise<void>;
  setDisabled(userId: string, disabled: boolean): Promise<void>;
  /** Blocks (or unblocks) the login itself, so refresh tokens stop working too. */
  setBanned(userId: string, banned: boolean): Promise<void>;
  listStaff(walletId: string): Promise<StaffListEntry[]>;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

type ActionHandler = (body: Record<string, unknown>, callerId: string, deps: StaffAdminDeps) => Promise<Response>;

const ownsWallet = async (deps: StaffAdminDeps, callerId: string, walletId: string) => (await deps.roleIn(callerId, walletId)) === 'owner';

const list: ActionHandler = async (body, callerId, deps) => {
  const walletId = text(body.wallet_id);
  if (!walletId) return reply(400, { error: 'Choose a wallet' });
  if (!(await ownsWallet(deps, callerId, walletId))) return reply(403, { error: 'Owners only' });
  return reply(200, { staff: await deps.listStaff(walletId) });
};

const create: ActionHandler = async (body, callerId, deps) => {
  const walletId = text(body.wallet_id);
  if (!walletId) return reply(400, { error: 'Choose a wallet' });
  if (!(await ownsWallet(deps, callerId, walletId))) return reply(403, { error: 'Owners only' });

  const username = text(body.username).toLowerCase();
  const displayName = text(body.display_name) || username;
  if (!username || username.length > 40) return reply(400, { error: 'Enter a username (up to 40 characters)' });
  if (!isPin(body.pin)) return reply(400, { error: 'The PIN must be exactly 6 digits' });
  if (await deps.usernameTaken(username)) return reply(409, { error: 'That username is taken' });

  const pinHash = await deps.hashPin(body.pin);
  const userId = await deps.createAuthUser(displayName);
  try {
    await deps.addStaff({ userId, walletId, username, pinHash });
  } catch (error) {
    console.error('staff-admin: could not add the staff member, removing the new login', error);
    await deps.deleteAuthUser(userId).catch((cleanup) => console.error('cleanup failed', cleanup));
    return reply(500, { error: 'Could not create the staff member' });
  }
  return reply(200, { id: userId });
};

/** Shared by the actions on one staff member: only staff of a wallet the caller owns, never another wallet's, never an owner. */
function onStaffMember(act: (targetId: string, body: Record<string, unknown>, deps: StaffAdminDeps) => Promise<void>, needsPin = false): ActionHandler {
  return async (body, callerId, deps) => {
    const targetId = text(body.user_id);
    if (!targetId) return reply(400, { error: 'Choose a staff member' });
    if (needsPin && !isPin(body.pin)) return reply(400, { error: 'The PIN must be exactly 6 digits' });

    const target = await deps.getMember(targetId);
    if (!target || target.role !== 'staff' || !(await ownsWallet(deps, callerId, target.walletId))) {
      return reply(403, { error: 'Owners only' });
    }
    await act(targetId, body, deps);
    return reply(200, { ok: true });
  };
}

const setDisabledAndBanned = (disabled: boolean) => async (userId: string, _body: Record<string, unknown>, deps: StaffAdminDeps) => {
  await deps.setDisabled(userId, disabled);
  await deps.setBanned(userId, disabled);
};

// A new action is one more entry here; the handler below does not change.
const ACTIONS: Record<string, ActionHandler> = {
  list,
  create,
  reset_pin: onStaffMember(async (userId, body, deps) => deps.setPinHash(userId, await deps.hashPin(body.pin as string)), true),
  disable: onStaffMember(setDisabledAndBanned(true)),
  enable: onStaffMember(setDisabledAndBanned(false)),
};

export async function handleStaffAdmin(req: Request, deps: StaffAdminDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  const caller = token ? await deps.getCaller(token) : null;
  if (!caller) return reply(401, { error: 'Not logged in' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply(400, { error: 'Invalid request' });
  }
  const handler = typeof body.action === 'string' && Object.hasOwn(ACTIONS, body.action) ? ACTIONS[body.action] : undefined;

  try {
    return handler ? await handler(body, caller.id, deps) : reply(400, { error: 'Unknown action' });
  } catch (error) {
    console.error('staff-admin failed', error);
    return reply(500, { error: 'Something went wrong. Try again.' });
  }
}
