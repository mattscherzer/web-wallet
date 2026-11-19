import { useContext } from 'react';
import { AuthContext, type AuthValue } from './authContext';

const SIGNED_OUT: AuthValue = {
  status: 'signedOut',
  user: null,
  profile: null,
  locked: false,
  lockedByIdle: false,
  can: () => true,
  signIn: async () => 'Not available',
  signInStaff: async () => ({ ok: false, kind: 'error', message: 'Not available' }),
  signOut: async () => {},
  lock: async () => {},
  unlock: async () => ({ ok: false, kind: 'error', message: 'Not available' }),
};

export function useAuth(): AuthValue {
  return useContext(AuthContext) ?? SIGNED_OUT;
}
