import { createContext } from 'react';
import { couldnt } from '../utils/copy';
import type { Role } from '../domain/access';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthProfile {
  displayName: string;
  kind: Role;
}

export type AccessResult =
  | { ok: true }
  | { ok: false; kind: 'wrong' }
  | { ok: false; kind: 'paused'; retryAfter: number }
  | { ok: false; kind: 'error'; message?: string };

export interface AuthValue {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  profile: AuthProfile | null;
  locked: boolean;
  lockedByIdle: boolean;
  can(action: string): boolean;
  signIn(email: string, password: string): Promise<string | null>;
  signInStaff(username: string, pin: string): Promise<AccessResult>;
  signOut(): Promise<void>;
  lock(): Promise<void>;
  unlock(secret: string): Promise<AccessResult>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export const COULDNT_CHECK = couldnt('check');
export const COULD_NOT_SIGN_IN = couldnt('sign in');
