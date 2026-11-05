import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));

import { checkOwnerPassword } from './passwordCheck';

beforeEach(() => {
  auth.signInWithPassword.mockReset();
  auth.signOut.mockClear();
});

describe('checking the owner password', () => {
  // the throwaway session this check opens is ended again
  it('T70', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    expect(await checkOwnerPassword('olga@x.org', 'pw')).toBe(true);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    // only the throwaway session: the owner's real session on this phone stays
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('T70b a refused password is false and opens no session to end', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { status: 400, code: 'invalid_credentials' } });
    expect(await checkOwnerPassword('olga@x.org', 'nope')).toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
