import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import WelcomePage from '../pages/WelcomePage';
import { useWallet } from '../wallet/useWallet';
import WalletsFailed from '../components/WalletsFailed';
import { AppShellSkeleton } from '../components/LoadingSkeletons';

export function WalletGate({ children }: { children: ReactNode }) {
  const { status, wallets, reload } = useWallet();
  const { pathname } = useLocation();

  if (status === 'loading') return <AppShellSkeleton />;

  if (status === 'error') return <WalletsFailed reload={reload} />;

  if (wallets.length === 0 && pathname !== '/wallets/new') return <WelcomePage />;
  return <>{children}</>;
}
