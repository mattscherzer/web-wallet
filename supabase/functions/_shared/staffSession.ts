
export interface StaffSessionClient {
  getUserEmail(userId: string): Promise<string>;
  /** auth.admin.generateLink({ type: 'magiclink', email }): returns a one-time code, nothing is emailed. */
  generateLink(input: { email: string }): Promise<{ data: { properties: { email_otp: string } } | null; error: { message: string } | null }>;
  verifyOtp(input: { email: string; token: string }): Promise<{ data: { session: Record<string, unknown> | null } | null; error: { message: string } | null }>;
}

export interface StaffUserCreator {
  createUser(input: {
    email: string;
    password: string;
    email_confirm: boolean;
    user_metadata: Record<string, string>;
  }): Promise<{ data: { user: { id: string } | null } | null; error: { message: string } | null }>;
}

export async function mintStaffSession(client: StaffSessionClient, userId: string): Promise<Record<string, unknown>> {
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

export async function createStaffAuthUser(client: StaffUserCreator, displayName: string): Promise<string> {
  const { data, error } = await client.createUser({
    email: `${crypto.randomUUID()}@staff.invalid`,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { display_name: displayName, kind: 'staff' },
  });
  if (error || !data?.user) throw new Error(`could not create the login: ${error?.message ?? 'unknown'}`);
  return data.user.id;
}
