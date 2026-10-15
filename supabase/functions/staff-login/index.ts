// Staff sign in with a username and a 6-digit PIN. Runs without a JWT check (nobody is logged in yet); the PIN is
// verified here, on the server, and a real Supabase session is returned. Needs the service-role key.
import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { handleStaffLogin } from '../_shared/staffLogin.ts';
import { mintStaffSession, type StaffAdminClient } from '../_shared/staffSession.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Compared against when the username is unknown, so that unknown and known names take the same time.
const DUMMY_HASH = bcrypt.hashSync('000000', 10);

const sessionClient: StaffAdminClient = {
  generateLink: async ({ email }) => {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    return { data: data?.properties ? { properties: { email_otp: data.properties.email_otp } } : null, error };
  },
  verifyOtp: async ({ email, token }) => {
    // A fresh client per login: the session is returned to the staff member, never kept here.
    const fresh = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await fresh.auth.verifyOtp({ email, token, type: 'email' });
    return { data: { session: data.session as unknown as Record<string, unknown> | null }, error };
  },
  signInWithPassword: () => Promise.reject(new Error('staff never sign in with a password')),
  createUser: () => Promise.reject(new Error('not used here')),
  getUserEmail: async (userId) => {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user?.email) throw new Error('unknown staff login');
    return data.user.email;
  },
};

Deno.serve((req) =>
  handleStaffLogin(req, {
    async beginAttempt(username) {
      const { data, error } = await admin.rpc('staff_begin_attempt', { p_username: username });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        userId: row?.user_id ?? null,
        pinHash: row?.pin_hash ?? null,
        disabled: row?.disabled === true,
        locked: row?.locked === true,
        retryAfter: Number(row?.retry_after ?? 0),
      };
    },
    async verifyPin(pin, hash) {
      const ok = await bcrypt.compare(pin, hash ?? DUMMY_HASH);
      return ok && hash !== null;
    },
    async resetAttempts(username) {
      const { error } = await admin.rpc('staff_reset_attempts', { p_username: username });
      if (error) throw new Error(error.message);
    },
    mintSession: (userId) => mintStaffSession(sessionClient, userId),
  }),
);
