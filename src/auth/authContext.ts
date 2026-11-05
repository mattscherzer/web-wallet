import { createContext } from 'react';

export type Role = 'owner' | 'staff';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthProfile {
  displayName: string;
  /** owner (email + password) or staff (username + PIN). */
  kind: Role;
}

/** Why a sign-in or unlock did not work: refused (`wrong`), `paused` for `retryAfter` seconds, or a failed check. */
export type AccessResult =
  | { ok: true }
  | { ok: false; kind: 'wrong' }
  | { ok: false; kind: 'paused'; retryAfter: number }
  | { ok: false; kind: 'error'; message?: string };

export interface AuthValue {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  profile: AuthProfile | null;
  /** Signed in but view only: the books can be read, nothing can be changed until unlocked. */
  locked: boolean;
  /** The app locked itself after 30 minutes without use (as opposed to the person tapping Lock). */
  lockedByIdle: boolean;
  /** Whether this person may do `action` (from the same role_permissions table the database uses). */
  can(action: string): boolean;
  /** Owner login. Resolves to an error message to show, or null when the login worked. */
  signIn(email: string, password: string): Promise<string | null>;
  /** Staff login with username and 6-digit PIN. */
  signInStaff(username: string, pin: string): Promise<AccessResult>;
  /** Ends the session on this device only. */
  signOut(): Promise<void>;
  /** Makes the app view only; the person stays signed in. */
  lock(): Promise<void>;
  /** Re-checks who is holding the phone: the staff PIN or the owner's password. Unlocks when it matches. */
  unlock(secret: string): Promise<AccessResult>;
}

export const AuthContext = createContext<AuthValue | null>(null);
