import { useContext } from 'react';
import { AuthContext, type AuthValue } from './authContext';

const SIGNED_OUT: AuthValue = {
  status: 'signedOut',
  user: null,
  profile: null,
  can: () => true, // outside a login (isolated component tests) nothing is hidden
  signIn: async () => 'Not available',
  signInStaff: async () => 'Not available',
  signOut: async () => {},
  lock: async () => {},
};

/** The logged-in user. Outside an AuthProvider (e.g. isolated component tests) nobody is logged in. */
export function useAuth(): AuthValue {
  return useContext(AuthContext) ?? SIGNED_OUT;
}
