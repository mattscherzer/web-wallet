import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../db/supabase';
import { CURRENT_WALLET_KEY } from '../wallet/walletStore';
import { AuthContext, type AuthProfile, type AuthUser, type AuthValue } from './authContext';

type State = Pick<AuthValue, 'status' | 'user' | 'profile'>;
const SIGNED_OUT: State = { status: 'signedOut', user: null, profile: null };

function forgetWallet() {
  try {
    window.localStorage.removeItem(CURRENT_WALLET_KEY);
  } catch {
    // Storage blocked: nothing was remembered anyway.
  }
}

async function loadProfile(user: AuthUser): Promise<AuthProfile> {
  const { data, error } = await supabase.from('profiles').select('display_name, is_admin').eq('id', user.id).single();
  if (error || !data) {
    console.error('Failed to load the profile:', error);
    return { displayName: user.email, isAdmin: false };
  }
  return { displayName: String(data.display_name) || user.email, isAdmin: data.is_admin === true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', user: null, profile: null });

  useEffect(() => {
    let live = true;

    const enter = async (session: { user: { id: string; email?: string } } | null) => {
      if (!session) {
        if (live) setState(SIGNED_OUT);
        return;
      }
      const user = { id: session.user.id, email: session.user.email ?? '' };
      const profile = await loadProfile(user);
      if (live) setState({ status: 'signedIn', user, profile });
    };

    supabase.auth.getSession().then(
      ({ data }) => enter(data.session),
      (err) => {
        console.error('Failed to read the session:', err);
        if (live) setState(SIGNED_OUT);
      },
    );

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        forgetWallet();
        setState(SIGNED_OUT);
      } else if (event === 'SIGNED_IN') {
        // Not awaited inside the callback: supabase-js can deadlock on calls made from here.
        setTimeout(() => void enter(session), 0);
      }
    });

    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    forgetWallet();
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Failed to sign out:', error);
    setState(SIGNED_OUT);
  }, []);

  const value = useMemo<AuthValue>(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
