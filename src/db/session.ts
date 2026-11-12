import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const getSession = () => supabase.auth.getSession();

export const onAuthStateChange = (callback: (event: AuthChangeEvent, session: Session | null) => void) =>
  supabase.auth.onAuthStateChange(callback);

export const signInWithPassword = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const setSession = (tokens: { access_token: string; refresh_token: string }) => supabase.auth.setSession(tokens);

export const signOutLocal = () => supabase.auth.signOut({ scope: 'local' });
