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

export interface AuthValue {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  profile: AuthProfile | null;
  /** Whether this person may do `action` (from the same role_permissions table the database uses). */
  can(action: string): boolean;
  /** Owner login. Resolves to an error message to show, or null when the login worked. */
  signIn(email: string, password: string): Promise<string | null>;
  /** Staff login with username and 6-digit PIN. Resolves to an error message to show, or null when it worked. */
  signInStaff(username: string, pin: string): Promise<string | null>;
  /** Ends the session on this device only. */
  signOut(): Promise<void>;
  /** Same as signOut, for the Lock button and the inactivity lock. */
  lock(): Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);
