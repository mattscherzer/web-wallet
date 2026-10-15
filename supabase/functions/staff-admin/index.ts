// Owners manage staff: create, reset a PIN, disable or enable, list. Needs the service-role key, so it only runs
// server-side; every action first checks that the caller owns the wallet involved.
import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { handleStaffAdmin } from '../_shared/staffAdmin.ts';
import { createStaffAuthUser, type StaffAdminClient } from '../_shared/staffSession.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const userCreator: StaffAdminClient = {
  generateLink: () => Promise.reject(new Error('not used here')),
  verifyOtp: () => Promise.reject(new Error('not used here')),
  signInWithPassword: () => Promise.reject(new Error('not used here')),
  createUser: async (input) => {
    const { data, error } = await admin.auth.admin.createUser(input);
    return { data: { user: data.user ? { id: data.user.id } : null }, error };
  },
  getUserEmail: () => Promise.reject(new Error('not used here')),
};

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

Deno.serve((req) =>
  handleStaffAdmin(req, {
    async getCaller(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },
    async roleIn(userId, walletId) {
      const { data } = await admin.from('wallet_members').select('role').eq('user_id', userId).eq('wallet_id', walletId).maybeSingle();
      return data?.role === 'owner' || data?.role === 'staff' ? data.role : null;
    },
    async getMember(userId) {
      const { data } = await admin.from('wallet_members').select('wallet_id, role').eq('user_id', userId).limit(1).maybeSingle();
      return data ? { userId, walletId: String(data.wallet_id), role: data.role === 'owner' ? 'owner' : 'staff' } : null;
    },
    async usernameTaken(username) {
      const { data } = await admin.from('staff_credentials').select('user_id').eq('username', username).maybeSingle();
      return data !== null;
    },
    hashPin: (pin) => bcrypt.hash(pin, 10),
    createAuthUser: (displayName) => createStaffAuthUser(userCreator, displayName),
    async addStaff({ userId, walletId, username, pinHash }) {
      const member = await admin.from('wallet_members').insert({ user_id: userId, wallet_id: walletId, role: 'staff' });
      fail('membership', member.error);
      const credential = await admin.from('staff_credentials').insert({ user_id: userId, wallet_id: walletId, username, pin_hash: pinHash });
      fail('credentials', credential.error);
    },
    async deleteAuthUser(userId) {
      await admin.auth.admin.deleteUser(userId);
    },
    async setPinHash(userId, pinHash) {
      const { error } = await admin.from('staff_credentials').update({ pin_hash: pinHash }).eq('user_id', userId);
      fail('pin', error);
      // A new PIN also clears a lock caused by wrong guesses.
      const { data } = await admin.from('staff_credentials').select('username').eq('user_id', userId).single();
      if (data) await admin.rpc('staff_reset_attempts', { p_username: data.username });
    },
    async setDisabled(userId, disabled) {
      const { error } = await admin
        .from('staff_credentials')
        .update({ disabled_at: disabled ? new Date().toISOString() : null })
        .eq('user_id', userId);
      fail('disable', error);
    },
    async setBanned(userId, banned) {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: banned ? '876000h' : 'none' });
      fail('ban', error);
    },
    async listStaff(walletId) {
      const { data, error } = await admin
        .from('staff_credentials')
        .select('user_id, username, wallet_id, disabled_at')
        .eq('wallet_id', walletId)
        .order('username');
      fail('list', error);
      const rows = data ?? [];
      const names = await admin.from('profiles').select('id, display_name').in('id', rows.map((r) => r.user_id));
      const byId = new Map((names.data ?? []).map((p) => [String(p.id), String(p.display_name)]));
      return rows.map((row) => ({
        user_id: String(row.user_id),
        username: String(row.username),
        wallet_id: String(row.wallet_id),
        display_name: byId.get(String(row.user_id)) ?? String(row.username),
        disabled: row.disabled_at !== null,
      }));
    },
  }),
);
