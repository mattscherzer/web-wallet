// How a staff login gets a real session, and how a staff login is created. The admin client is passed in, so this
// can be unit-tested without Supabase.

export interface StaffAdminClient {
  /** auth.admin.generateLink({ type: 'magiclink', email }): returns a one-time code, nothing is emailed. */
  generateLink(input: { email: string }): Promise<{ data: { properties: { email_otp: string } } | null; error: { message: string } | null }>;
  /** Exchanges the one-time code for a session (on a client that does not keep it). */
  verifyOtp(input: { email: string; token: string }): Promise<{ data: { session: Record<string, unknown> | null } | null; error: { message: string } | null }>;
  /** Never used for staff: present so a test can prove it is not. */
  signInWithPassword(input: { email: string; password: string }): Promise<unknown>;
  createUser(input: {
    email: string;
    password: string;
    email_confirm: boolean;
    user_metadata: Record<string, string>;
  }): Promise<{ data: { user: { id: string } | null } | null; error: { message: string } | null }>;
  getUserEmail(userId: string): Promise<string>;
}

/** A session for staff member `userId`, from a one-time code made and checked on the server. No password is involved. */
export async function mintStaffSession(client: StaffAdminClient, userId: string): Promise<Record<string, unknown>> {
  const email = await client.getUserEmail(userId);
  const link = await client.generateLink({ email });
  const token = link.data?.properties.email_otp;
  if (link.error || !token) throw new Error(`could not start a session: ${link.error?.message ?? 'no code'}`);
  const verified = await client.verifyOtp({ email, token });
  const session = verified.data?.session;
  if (verified.error || !session) throw new Error(`could not start a session: ${verified.error?.message ?? 'no session'}`);
  return session;
}

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates the login behind a staff member: an address with no personal data, the staff kind, and a random password
 * that is thrown away (nobody can sign in with it; the only way in is staff-login).
 */
export async function createStaffAuthUser(client: StaffAdminClient, displayName: string): Promise<string> {
  const { data, error } = await client.createUser({
    email: `${crypto.randomUUID()}@staff.invalid`,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { display_name: displayName, kind: 'staff' },
  });
  if (error || !data?.user) throw new Error(`could not create the login: ${error?.message ?? 'unknown'}`);
  return data.user.id;
}
