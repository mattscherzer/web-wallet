import { createClient } from '@supabase/supabase-js';

/**
 * Checks the owner's password (false when it is wrong, throws when the check itself fails) on a separate client that keeps no session, so the app's own session (and everything
 * listening to it) stays untouched.
 */
export async function checkOwnerPassword(email: string, password: string): Promise<boolean> {
  const checker = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await checker.auth.signInWithPassword({ email, password });
  if (!error) return true;
  // A refused password is an answer; anything else (offline, server failure) means we could not check.
  if (error.status === 400 || error.status === 401 || error.code === 'invalid_credentials') return false;
  throw error;
}
