import { describe, expect, it, vi } from 'vitest';
import { handleCreateUser, type CreateUserDeps } from './createUser';

const ADMIN_TOKEN = 'admin-token';
const MEMBER_TOKEN = 'member-token';

function setup(overrides: Partial<CreateUserDeps> = {}) {
  const created: { email: string; displayName: string }[] = [];
  const memberships: { userId: string; walletIds: string[] }[] = [];
  const deleted: string[] = [];
  const deps: CreateUserDeps = {
    getCaller: async (token) =>
      token === ADMIN_TOKEN ? { id: 'admin-1', isAdmin: true } : token === MEMBER_TOKEN ? { id: 'u-2', isAdmin: false } : null,
    createUser: async ({ email, displayName }) => {
      if (created.some((u) => u.email === email)) return { error: 'duplicate' };
      created.push({ email, displayName });
      return { id: `new-${created.length}` };
    },
    addMemberships: async (userId, walletIds) => {
      memberships.push({ userId, walletIds });
    },
    deleteUser: async (id) => {
      deleted.push(id);
    },
    ...overrides,
  };
  const call = (token: string | null, body: unknown) =>
    handleCreateUser(
      new Request('http://fn/admin-create-user', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(body),
      }),
      deps,
    );
  return { call, created, memberships, deleted };
}

const GOOD = { email: 'new@x.org', password: 'a-long-password', displayName: 'Nina', walletIds: ['w1', 'w2'] };

describe('admin-create-user', () => {
  it('T7 refuses callers without a valid token and callers who are not admin, and creates nobody', async () => {
    const s = setup();
    expect((await s.call(null, GOOD)).status).toBe(401);
    expect((await s.call('expired', GOOD)).status).toBe(401);
    expect((await s.call(MEMBER_TOKEN, GOOD)).status).toBe(403);
    expect(s.created).toEqual([]);
  });

  it('T8 an admin creates a user with a name and wallets, and bad input is refused', async () => {
    const s = setup();
    const res = await s.call(ADMIN_TOKEN, GOOD);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'new-1' });
    expect(s.created).toEqual([{ email: 'new@x.org', displayName: 'Nina' }]);
    expect(s.memberships).toEqual([{ userId: 'new-1', walletIds: ['w1', 'w2'] }]);

    expect((await s.call(ADMIN_TOKEN, { ...GOOD, email: 'not-an-email' })).status).toBe(400);
    expect((await s.call(ADMIN_TOKEN, { ...GOOD, email: 'b@x.org', password: 'short' })).status).toBe(400);
    expect(s.created).toHaveLength(1);
  });

  it('T8b a duplicate email is reported, and a user whose wallets could not be set is removed again', async () => {
    const s = setup();
    await s.call(ADMIN_TOKEN, GOOD);
    expect((await s.call(ADMIN_TOKEN, GOOD)).status).toBe(409);

    const failing = setup({ addMemberships: vi.fn().mockRejectedValue(new Error('boom')) });
    const res = await failing.call(ADMIN_TOKEN, GOOD);
    expect(res.status).toBe(500);
    expect(failing.deleted).toEqual(['new-1']);
  });
});
