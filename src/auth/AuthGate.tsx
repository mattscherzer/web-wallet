import type { ReactNode } from 'react';
import LoginPage from './LoginPage';
import { useAuth } from './useAuth';

/** Shows the app only to a logged-in user; everyone else gets the login form. Nothing below it loads data before that. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <div className="route-fallback" role="status" aria-label="Loading">
        <span className="route-fallback__spinner" />
      </div>
    );
  }
  if (status === 'signedOut') return <LoginPage />;
  return <>{children}</>;
}
