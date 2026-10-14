import { describe, expect, it } from 'vitest';
import { handleStaffAdmin, type StaffAdminDeps } from './staffAdmin';

const OWNER = 'owner-token';
const STAFF = 'staff-token';
const OTHER_OWNER = 'other-owner-token';
const W1 = 'w1';
const W2 = 'w2';

function setup(overrides: Partial<StaffAdminDeps> = {}) {
  const log: string[] = [];
  const staff: Record<string, { walletId: string; role: 'staff' | 'owner' }> = {
    'u-anna': { walletId: W1, role: 'staff' },
    'u-bea': { walletId: W2, role: 'staff' },
    'u-owner': { walletId: W1, role: 'owner' },
  };
  const users = new Set<string>();
  const deps: StaffAdminDeps = {
    getCaller: async (token) =>
      ({ [OWNER]: { id: 'u-owner' }, [STAFF]: { id: 'u-anna' }, [OTHER_OWNER]: { id: 'u-owner-2' } })[token] ?? null,
    roleIn: async (userId, walletId) =>
      userId === 'u-owner' && walletId === W1 ? 'owner' : userId === 'u-owner-2' && walletId === W2 ? 'owner' : userId === 'u-anna' && walletId === W1 ? 'staff' : null,
    getMember: async (userId) => (staff[userId] ? { userId, ...staff[userId] } : null),
    usernameTaken: async (name) => name === 'taken',
    hashPin: async (pin) => `hash:${pin}`,
    createAuthUser: async (displayName) => {
      const id = `new-${displayName}`;
      users.add(id);
      log.push(`auth:${id}`);
      return id;
    },
    addStaff: async ({ userId, walletId, username, pinHash }) => {
      log.push(`staff:${userId}:${walletId}:${username}:${pinHash}`);
    },
    deleteAuthUser: async (id) => {
      users.delete(id);
      log.push(`deleted:${id}`);
    },
    setPinHash: async (userId, pinHash) => {
      log.push(`pin:${userId}:${pinHash}`);
    },
    listStaff: async () => [],
    setBanned: async (userId, banned) => {
      log.push(`${banned ? 'ban' : 'unban'}:${userId}`);
    },
    setDisabled: async (userId, disabled) => {
      log.push(`${disabled ? 'disable' : 'enable'}:${userId}`);
    },
    ...overrides,
  };
  const call = (token: string | null, payload: unknown) =>
    handleStaffAdmin(
      new Request('http://fn/staff-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      }),
      deps,
    );
  return { call, log, users };
}

const create = { action: 'create', wallet_id: W1, username: 'mia', display_name: 'Mia', pin: '246810' };

describe('staff admin', () => {
  it('T14 only the owner of that wallet can create staff; the PIN is stored hashed and must be 6 digits; failures leave nothing behind', async () => {
    const s = setup();
    expect((await s.call(null, create)).status).toBe(401);
    expect((await s.call('bad-token', create)).status).toBe(401);
    expect((await s.call(STAFF, create)).status).toBe(403);
    expect((await s.call(OTHER_OWNER, create)).status).toBe(403);
    for (const pin of ['1234', '1234567', 'abcdef', 246810]) {
      expect((await s.call(OWNER, { ...create, pin })).status, String(pin)).toBe(400);
    }
    expect((await s.call(OWNER, { ...create, username: '' })).status).toBe(400);
    expect((await s.call(OWNER, { ...create, username: 'taken' })).status).toBe(409);
    expect(s.log).toEqual([]);

    const ok = await s.call(OWNER, create);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ id: 'new-Mia' });
    expect(s.log).toEqual(['auth:new-Mia', `staff:new-Mia:${W1}:mia:hash:246810`]);
    expect(s.log.join()).not.toContain(':246810:');

    const failing = setup({
      addStaff: async () => {
        throw new Error('db down');
      },
    });
    const bad = await failing.call(OWNER, create);
    expect(bad.status).toBe(500);
    expect(failing.log).toEqual(['auth:new-Mia', 'deleted:new-Mia']);
    expect(failing.users.size).toBe(0);
  });

  it('T14b the owner can reset a PIN and disable or re-enable staff', async () => {
    const s = setup();
    expect((await s.call(OWNER, { action: 'reset_pin', user_id: 'u-anna', pin: '135790'  })).status).toBe(200);
    expect((await s.call(OWNER, { action: 'disable', user_id: 'u-anna'  })).status).toBe(200);
    expect((await s.call(OWNER, { action: 'enable', user_id: 'u-anna'  })).status).toBe(200);
    // Disabling also bans the login (so refresh tokens stop working); enabling lifts the ban.
    expect(s.log).toEqual(['pin:u-anna:hash:135790', 'disable:u-anna', 'ban:u-anna', 'enable:u-anna', 'unban:u-anna']);

    const bad = setup();
    expect((await bad.call(OWNER, { action: 'reset_pin', user_id: 'u-anna', pin: '1234'  })).status).toBe(400);
    expect((await bad.call(STAFF, { action: 'disable', user_id: 'u-anna'  })).status).toBe(403);
    expect(bad.log).toEqual([]);
  });

  it('T14e the owner can list the staff of their wallet, and nobody else can', async () => {
    const s = setup({
      listStaff: async (walletId) => [{ user_id: 'u-anna', username: 'anna', display_name: 'Anna', wallet_id: walletId, disabled: false }],
    });
    const ok = await s.call(OWNER, { action: 'list', wallet_id: W1 });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ staff: [{ user_id: 'u-anna', username: 'anna', display_name: 'Anna', wallet_id: W1, disabled: false }] });
    expect((await s.call(STAFF, { action: 'list', wallet_id: W1 })).status).toBe(403);
    expect((await s.call(OWNER, { action: 'list', wallet_id: W2 })).status).toBe(403);
  });

  it('T14d an owner can only manage staff of their own wallet: not another wallet\'s staff, not an owner, not a stranger', async () => {
    const s = setup();
    for (const action of ['reset_pin', 'disable', 'enable']) {
      for (const target of ['u-bea', 'u-owner', 'u-unknown']) {
        const res = await s.call(OWNER, { action, user_id: target, pin: '135790'  });
        expect(res.status, `${action} ${target}`).toBe(403);
      }
    }
    expect(s.log).toEqual([]);
  });
});
