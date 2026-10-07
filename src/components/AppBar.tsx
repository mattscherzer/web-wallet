import { lazy, Suspense, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useOptionalWallet } from '../wallet/useWallet';
import { walletInitials } from '../wallet/walletStore';

// Loaded on first open: keeps the data layer out of the shell's initial code.
const WalletSwitcher = lazy(() => import('./WalletSwitcher'));

/** Top bar with the open wallet's name; opens the wallet switcher. Draws nothing without a wallet. */
export default function AppBar() {
  const wallet = useOptionalWallet();
  const [open, setOpen] = useState(false);
  const current = wallet?.current;
  if (!current) return null;

  return (
    <>
      <header className="app-bar">
        <button
          type="button"
          className="app-bar__wallet"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          id="wallet-switch-btn"
        >
          <span className="wallet-avatar wallet-avatar--current" aria-hidden="true">
            {walletInitials(current.name)}
          </span>
          <span className="app-bar__name">{current.name}</span>
          <ChevronDown size={20} aria-hidden="true" />
        </button>
      </header>
      {open && (
        <Suspense fallback={null}>
          <WalletSwitcher onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
