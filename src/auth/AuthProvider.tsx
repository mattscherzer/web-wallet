import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../db/supabase';
import { CURRENT_WALLET_KEY } from '../wallet/walletStore';
import { AuthContext, type AuthProfile, type AuthUser, type AuthValue, type Role } from './authContext';
import { functionErrorMessage } from './functionError';
import { idleExpired, useIdleLock } from './idleLock';

type State = Pick<AuthValue, 'status' | 'user' | 'profile'> & { permissions: ReadonlySet<string> };
const SIGNED_OUT: State = { status: 'signedOut', user: null, profile: null, permissions: new Set() };

function forgetWallet() {
  try {
    window.localStorage.removeItem(CURRENT_WALLET_KEY);
  } catch {
    // Storage blocked: nothing was remembered anyway.
  }
}

async function loadProfile(user: AuthUser): Promise<{ profile: AuthProfile; permissions: ReadonlySet<string> }> {
  const { data, error } = await supabase.from('profiles').select('display_name, kind').eq('id', user.id).single();
  if (error || !data) {
    console.error('Failed to load the profile:', error);
    // Without a profile nothing is offered; the database refuses anyway.
    return { profile: { displayName: user.email, kind: 'staff' }, permissions: new Set() };
  }
  const kind: Role = data.kind === 'owner' ? 'owner' : 'staff';
  const perms = await supabase.from('role_permissions').select('action').eq('role', kind);
  if (perms.error) console.error('Failed to load the permissions:', perms.error);
  return {
    profile: { displayName: String(data.display_name) || user.email, kind },
    permissions: new Set((perms.data ?? []).map((p) => String(p.action))),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ ...SIGNED_OUT, status: 'loading' });

  useEffect(() => {
    let live = true;

    const enter = async (session: { user: { id: string; email?: string } } | null) => {
      if (!session) {
        if (live) setState(SIGNED_OUT);
        return;
      }
      const user = { id: session.user.id, email: session.user.email ?? '' };
      const { profile, permissions } = await loadProfile(user);
      if (live) setState({ status: 'signedIn', user, profile, permissions });
    };

    supabase.auth.getSession().then(
      async ({ data }) => {
        // The app was closed or reloaded after the idle limit: the device is locked, sign in again.
        if (data.session && idleExpired()) {
          forgetWallet();
          await supabase.auth.signOut({ scope: 'local' });
          if (live) setState(SIGNED_OUT);
          return;
        }
        return enter(data.session);
      },
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

  const signInStaff = useCallback(async (username: string, pin: string) => {
    const { data, error } = await supabase.functions.invoke('staff-login', {
      body: { username: username.trim(), pin },
    });
    if (error) return functionErrorMessage(error, 'Could not sign in. Try again.');
    const session = (data as { session?: { access_token?: string; refresh_token?: string } } | null)?.session;
    if (!session?.access_token || !session.refresh_token) return 'Could not sign in. Try again.';
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return sessionError ? sessionError.message : null;
  }, []);

  // Ends the session on this device only: other devices of the same account stay signed in.
  const signOut = useCallback(async () => {
    forgetWallet();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.error('Failed to sign out:', error);
    setState(SIGNED_OUT);
  }, []);

  useIdleLock(state.status === 'signedIn', () => void signOut());

  const can = useCallback((action: string) => state.permissions.has(action), [state.permissions]);
  const value = useMemo<AuthValue>(
    () => ({
      status: state.status,
      user: state.user,
      profile: state.profile,
      can,
      signIn,
      signInStaff,
      signOut,
      lock: signOut,
    }),
    [state.status, state.user, state.profile, can, signIn, signInStaff, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
