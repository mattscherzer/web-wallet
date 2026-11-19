import { createClient } from '@supabase/supabase-js';

/** False when the password is wrong; throws when the check itself fails. */
export async function checkOwnerPassword(email: string, password: string): Promise<boolean> {
  const checker = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await checker.auth.signInWithPassword({ email, password });
  if (!error) {
    await checker.auth
      .signOut({ scope: 'local' })
      .catch((err: unknown) => console.warn('Could not end the check session:', err));
    return true;
  }
  if (error.status === 400 || error.status === 401 || error.code === 'invalid_credentials') return false;
  throw error;
}
