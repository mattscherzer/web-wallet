import type { ReactNode } from 'react';
import LoginPage from '../pages/LoginPage';
import { UnlockProvider } from '../auth/UnlockProvider';
import { useAuth } from '../auth/useAuth';
import { AppShellSkeleton } from '../components/LoadingSkeletons';

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <AppShellSkeleton />;
  if (status === 'signedOut') return <LoginPage />;
  return <UnlockProvider>{children}</UnlockProvider>;
}
