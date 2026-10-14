import { createContext } from 'react';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthProfile {
  displayName: string;
  isAdmin: boolean;
}

export interface AuthValue {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  profile: AuthProfile | null;
  /** Resolves to an error message to show, or null when the login worked. */
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);
