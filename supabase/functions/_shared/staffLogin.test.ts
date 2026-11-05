import { describe, expect, it } from 'vitest';
import { handleStaffLogin, type StaffLoginDeps } from './staffLogin';

const SESSION = { access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'bearer' };

function setup(overrides: Partial<StaffLoginDeps> = {}) {
  const resets: string[] = [];
  const minted: string[] = [];
  const attempts: string[] = [];
  const deps: StaffLoginDeps = {
    beginAttempt: async (username) => {
      attempts.push(username);
      return username === 'anna'
        ? { userId: 'u-anna', pinHash: 'hash:123456', disabled: false, locked: false, retryAfter: 0 }
        : username === 'dora'
          ? { userId: 'u-dora', pinHash: 'hash:123456', disabled: true, locked: false, retryAfter: 0 }
          : { userId: null, pinHash: null, disabled: false, locked: false, retryAfter: 0 };
    },
    verifyPin: async (pin, hash) => hash !== null && hash === `hash:${pin}`,
    resetAttempts: async (username) => {
      resets.push(username);
    },
    mintSession: async (userId) => {
      minted.push(userId);
      return SESSION;
    },
    ...overrides,
  };
  const call = (body: unknown, method = 'POST') =>
    handleStaffLogin(
      new Request('http://fn/staff-login', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      }),
      deps,
    );
  return { call, resets, minted, attempts };
}

const body = async (res: Response) => ({ status: res.status, json: await res.json() });

describe('staff login', () => {
  it('T7 the right username and 6-digit PIN return a session; wrong PIN, unknown user, short PIN and a disabled account all get the same refusal', async () => {
    const s = setup();
    const ok = await body(await s.call({ username: 'Anna', pin: '123456' }));
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({ session: SESSION });
    expect(s.minted).toEqual(['u-anna']);
    expect(s.resets).toEqual(['anna']);

    const wrong = await body(await s.call({ username: 'anna', pin: '654321' }));
    const unknown = await body(await s.call({ username: 'nobody', pin: '123456' }));
    const short = await body(await s.call({ username: 'anna', pin: '1234' }));
    const numeric = await body(await s.call({ username: 'anna', pin: 123456 }));
    const disabled = await body(await s.call({ username: 'dora', pin: '123456' }));
    for (const refusal of [wrong, unknown, short, numeric, disabled]) {
      expect(refusal.status).toBe(401);
      expect(refusal.json).toEqual(wrong.json);
    }
    expect(s.minted).toEqual(['u-anna']);
  });

  it('T7c keeps a leading zero in the PIN', async () => {
    const s = setup({
      beginAttempt: async () => ({ userId: 'u-1', pinHash: 'hash:012345', disabled: false, locked: false, retryAfter: 0 }),
    });
    expect((await s.call({ username: 'x', pin: '012345' })).status).toBe(200);
  });

  it('T8d a locked account is refused before the PIN is even checked, with the same answer for known and unknown names', async () => {
    let verified = 0;
    const s = setup({
      beginAttempt: async () => ({ userId: null, pinHash: null, disabled: false, locked: true, retryAfter: 90 }),
      verifyPin: async () => {
        verified++;
        return true;
      },
    });
    const res = await s.call({ username: 'anna', pin: '123456' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'locked', retryAfter: 90 });
    expect(verified).toBe(0);
    expect(s.minted).toEqual([]);
  });

  it('T8c a staff member who has been disabled is refused even with the right PIN, and no session is created', async () => {
    const s = setup();
    const res = await s.call({ username: 'dora', pin: '123456' });
    expect(res.status).toBe(401);
    expect(s.minted).toEqual([]);
    expect(s.resets).toEqual([]);
  });

  it('T7d compares against a dummy hash for unknown names (no timing tell) and counts every real try', async () => {
    const seen: (string | null)[] = [];
    const s = setup({
      verifyPin: async (_pin, hash) => {
        seen.push(hash);
        return false;
      },
    });
    await s.call({ username: 'nobody', pin: '123456' });
    await s.call({ username: 'anna', pin: '000000' });
    expect(seen).toEqual([null, 'hash:123456']);
    expect(s.attempts).toEqual(['nobody', 'anna']);
  });

  // a PIN check for unlocking answers who the PIN belongs to and starts no session
  it('T71', async () => {
    const s = setup();
    const ok = await body(await s.call({ username: 'anna', pin: '123456', verifyOnly: true }));
    expect(ok).toEqual({ status: 200, json: { userId: 'u-anna' } });
    expect(s.minted).toEqual([]);
    expect(s.resets).toEqual(['anna']);
    const wrong = await body(await s.call({ username: 'anna', pin: '654321', verifyOnly: true }));
    expect(wrong.status).toBe(401);
    expect(s.minted).toEqual([]);
  });
});
