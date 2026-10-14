import { createClient } from '@supabase/supabase-js';

/**
 * Checks the owner's password on a separate client that keeps no session, so the app's own session (and everything
 * listening to it) stays untouched.
 */
export async function checkOwnerPassword(email: string, password: string): Promise<boolean> {
  const checker = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await checker.auth.signInWithPassword({ email, password });
  return !error;
}
