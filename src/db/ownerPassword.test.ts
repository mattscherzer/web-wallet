import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));

import { checkOwnerPassword } from './ownerPassword';

beforeEach(() => {
  auth.signInWithPassword.mockReset();
  auth.signOut.mockClear();
});

describe('checking the owner password', () => {
  it('T70 the throwaway session the check opens is ended again, and the owners real session stays', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    expect(await checkOwnerPassword('olga@x.org', 'pw')).toBe(true);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('T70b a refused password is false and opens no session to end', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { status: 400, code: 'invalid_credentials' } });
    expect(await checkOwnerPassword('olga@x.org', 'nope')).toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
