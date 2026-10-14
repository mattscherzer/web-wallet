import { describe, expect, it, vi } from 'vitest';
import { createStaffAuthUser, mintStaffSession, type StaffAdminClient } from './staffSession';

function fakeAdmin(overrides: Partial<StaffAdminClient> = {}) {
  const calls: string[] = [];
  const createUserArgs: unknown[] = [];
  const client: StaffAdminClient = {
    generateLink: vi.fn(async ({ email }) => {
      calls.push(`generateLink:${email}`);
      return { data: { properties: { email_otp: '123456', hashed_token: 'h' } }, error: null };
    }),
    verifyOtp: vi.fn(async ({ email, token }) => {
      calls.push(`verifyOtp:${email}:${token}`);
      return { data: { session: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'bearer' } }, error: null };
    }),
    signInWithPassword: vi.fn(async () => {
      calls.push('signInWithPassword');
      return { data: { session: null }, error: { message: 'must not be used' } };
    }),
    createUser: vi.fn(async (args) => {
      createUserArgs.push(args);
      return { data: { user: { id: 'new-id' } }, error: null };
    }),
    getUserEmail: vi.fn(async () => 'new-id@staff.invalid'),
    ...overrides,
  };
  return { client, calls, createUserArgs };
}

describe('staff sessions', () => {
  it('T7e a staff session comes from a one-time link checked on the server, never from a stored or derived password', async () => {
    const { client, calls } = fakeAdmin();
    const session = await mintStaffSession(client, 'new-id');
    expect(session).toMatchObject({ access_token: 'at', refresh_token: 'rt' });
    expect(calls).toEqual(['generateLink:new-id@staff.invalid', 'verifyOtp:new-id@staff.invalid:123456']);
    expect(client.signInWithPassword).not.toHaveBeenCalled();
  });

  it('T7f a failed link refuses the login instead of falling back to a password', async () => {
    const { client } = fakeAdmin({ generateLink: async () => ({ data: null, error: { message: 'boom' } }) });
    await expect(mintStaffSession(client, 'new-id')).rejects.toThrow();
    expect(client.signInWithPassword).not.toHaveBeenCalled();
  });

  it('T14f a staff login is created with a random password nobody keeps, an address with no personal data, and the staff kind', async () => {
    const a = fakeAdmin();
    const b = fakeAdmin();
    const id = await createStaffAuthUser(a.client, 'Mia');
    await createStaffAuthUser(b.client, 'Mia');
    expect(id).toBe('new-id');
    const first = a.createUserArgs[0] as { email: string; password: string; email_confirm: boolean; user_metadata: Record<string, string> };
    const second = b.createUserArgs[0] as { password: string };
    expect(first.email).toMatch(/^[0-9a-f-]{36}@staff\.invalid$/);
    expect(first.email_confirm).toBe(true);
    expect(first.password.length).toBeGreaterThanOrEqual(32);
    expect(first.password).not.toBe(second.password);
    expect(first.user_metadata).toEqual({ display_name: 'Mia', kind: 'staff' });
  });
});
