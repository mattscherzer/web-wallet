// Creates a login on behalf of an admin. Needs the service-role key, so it can only run server-side.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCreateUser } from '../_shared/createUser.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

Deno.serve((req) =>
  handleCreateUser(req, {
    async getCaller(token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return null;
      const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle();
      return { id: data.user.id, isAdmin: profile?.is_admin === true };
    },
    async createUser({ email, password, displayName }) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (error || !data.user) return { error: error?.code === 'email_exists' || error?.code === 'user_already_exists' ? 'duplicate' : 'failed' };
      return { id: data.user.id };
    },
    async addMemberships(userId, walletIds) {
      const { error } = await admin.from('wallet_members').insert(walletIds.map((wallet_id) => ({ user_id: userId, wallet_id })));
      if (error) throw new Error(error.message);
    },
    async deleteUser(userId) {
      await admin.auth.admin.deleteUser(userId);
    },
  }),
);
