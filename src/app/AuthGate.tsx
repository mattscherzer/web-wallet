import type { ReactNode } from 'react';
import LoginPage from '../pages/LoginPage';
import { UnlockProvider } from '../auth/UnlockProvider';
import { useAuth } from '../auth/useAuth';
import RouteFallback from '../components/RouteFallback';

/** Shows the app only to a logged-in user; everyone else gets the login form. Nothing below it loads data before that. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') {
    return <RouteFallback />;
  }
  if (status === 'signedOut') return <LoginPage />;
  return <UnlockProvider>{children}</UnlockProvider>;
}
