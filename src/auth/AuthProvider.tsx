import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../db/supabase';
import { CURRENT_WALLET_KEY } from '../wallet/walletStore';
import {
  AuthContext,
  type AccessResult,
  type AuthProfile,
  type AuthUser,
  type AuthValue,
  type Role,
} from './authContext';
import { checkOwnerPassword } from './passwordCheck';
import { idleExpired, rememberActivity, useIdleLock } from './idleLock';
import { checkStaffPin, forgetStaff, readLastStaff, rememberStaff, requestStaffLogin } from './staffLogin';

type State = Pick<AuthValue, 'status' | 'user' | 'profile'> & { permissions: ReadonlySet<string> };
const SIGNED_OUT: State = { status: 'signedOut', user: null, profile: null, permissions: new Set() };

function forgetWallet() {
  try {
    window.localStorage.removeItem(CURRENT_WALLET_KEY);
  } catch {
    // Storage blocked: nothing was remembered anyway.
  }
}

/** Kept in storage so a reload or reopened app is still locked. */
const LOCKED_KEY = 'treasury.locked';
type LockReason = 'manual' | 'idle';

function readLock(): LockReason | null {
  try {
    const v = window.localStorage.getItem(LOCKED_KEY);
    return v === 'manual' || v === 'idle' ? v : null;
  } catch {
    return null;
  }
}

function writeLock(reason: LockReason | null) {
  try {
    if (reason) window.localStorage.setItem(LOCKED_KEY, reason);
    else window.localStorage.removeItem(LOCKED_KEY);
  } catch {
    // Storage blocked: the lock then lasts until the app is reloaded.
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
  // Apart from `state`: signing in again (a repeated SIGNED_IN event) must not unlock a locked app.
  const [lockReason, setLockReason] = useState<LockReason | null>(readLock);
  const applyLock = useCallback((reason: LockReason | null) => {
    writeLock(reason);
    setLockReason(reason);
  }, []);

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
        // The app was closed or reloaded after the idle limit: it comes back locked, still signed in.
        if (data.session && idleExpired() && !readLock()) applyLock('idle');
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
        applyLock(null);
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
  }, [applyLock]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!error) applyLock(null);
      return error ? error.message : null;
    },
    [applyLock],
  );

  const signInStaff = useCallback(
    async (username: string, pin: string): Promise<AccessResult> => {
      const name = username.trim().toLowerCase();
      const result = await requestStaffLogin(name, pin);
      if (!result.ok) return result.kind === 'error' ? { ok: false, kind: 'error' } : result;
      const { error } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (error) return { ok: false, kind: 'error', message: error.message };
      rememberStaff(name);
      applyLock(null);
      return { ok: true };
    },
    [applyLock],
  );

  // Ends the session on this device only: other devices of the same account stay signed in.
  const signOut = useCallback(async () => {
    forgetWallet();
    forgetStaff(); // handing the phone over: the next person types their own username
    applyLock(null);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.error('Failed to sign out:', error);
    setState(SIGNED_OUT);
  }, [applyLock]);

  const lock = useCallback(async () => applyLock('manual'), [applyLock]);

  // Re-checks who holds the phone. The session stays as it is: unlocking only lifts the app-level lock.
  const user = state.user;
  const kind = state.profile?.kind;
  const unlock = useCallback(
    async (secret: string): Promise<AccessResult> => {
      if (!user) return { ok: false, kind: 'error' };
      if (kind === 'owner') {
        let ok: boolean;
        try {
          ok = await checkOwnerPassword(user.email, secret);
        } catch {
          return { ok: false, kind: 'error' };
        }
        if (!ok) return { ok: false, kind: 'wrong' };
      } else {
        const username = readLastStaff();
        if (!username) return { ok: false, kind: 'error' }; // nobody to check the PIN for
        const result = await checkStaffPin(username, secret);
        if (!result.ok) return result;
        // The PIN has to belong to the person signed in on this phone, not just to some staff member.
        if (result.userId !== user.id) return { ok: false, kind: 'wrong' };
      }
      rememberActivity();
      applyLock(null);
      return { ok: true };
    },
    [user, kind, applyLock],
  );

  const signedIn = state.status === 'signedIn';
  useIdleLock(signedIn && lockReason === null, () => applyLock('idle'));

  const can = useCallback((action: string) => state.permissions.has(action), [state.permissions]);
  const value = useMemo<AuthValue>(
    () => ({
      status: state.status,
      user: state.user,
      profile: state.profile,
      locked: signedIn && lockReason !== null,
      lockedByIdle: signedIn && lockReason === 'idle',
      can,
      signIn,
      signInStaff,
      signOut,
      lock,
      unlock,
    }),
    [state.status, state.user, state.profile, signedIn, lockReason, can, signIn, signInStaff, signOut, lock, unlock],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
