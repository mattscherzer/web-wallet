import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, X } from 'lucide-react';
import { fetchWalletAvailableBalances } from '../db/wallets';
import { useWallet } from '../wallet/WalletContext';
import { walletInitials } from '../wallet/walletStore';
import { formatCurrency } from '../utils/formatCurrency';

/** Bottom sheet listing the wallets (design: WalletSwitcher). */
export default function WalletSwitcher({ onClose }: { onClose: () => void }) {
  const { wallets, current, switchWallet } = useWallet();
  const navigate = useNavigate();
  const [balances, setBalances] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let live = true;
    fetchWalletAvailableBalances(wallets.map((w) => w.id))
      .then((b) => live && setBalances(b))
      .catch((err) => console.error('Failed to load wallet balances:', err));
    return () => {
      live = false;
    };
  }, [wallets]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = (id: string) => {
    switchWallet(id);
    onClose();
    navigate('/');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="wallet-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Wallets"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wallet-sheet__header">
          <h2 className="wallet-sheet__title">Wallets</h2>
          <button type="button" className="wallet-sheet__close" aria-label="Close" onClick={onClose}>
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <p className="wallet-sheet__hint">Each wallet has its own accounts, categories, members and history.</p>

        <ul className="wallet-sheet__list">
          {wallets.map((w) => {
            const isCurrent = w.id === current?.id;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  className={`wallet-row${isCurrent ? ' wallet-row--current' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => choose(w.id)}
                >
                  <span className={`wallet-avatar${isCurrent ? ' wallet-avatar--current' : ''}`} aria-hidden="true">
                    {walletInitials(w.name)}
                  </span>
                  <span className="wallet-row__text">
                    <span className="wallet-row__name">{w.name}</span>
                    <span className="wallet-row__balance">
                      {balances ? formatCurrency(balances[w.id] ?? 0) : '…'}
                    </span>
                  </span>
                  {isCurrent && <Check size={24} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className="btn btn--outline wallet-sheet__new"
          onClick={() => {
            onClose();
            navigate('/wallets/new');
          }}
        >
          <Plus size={20} aria-hidden="true" /> New wallet
        </button>
      </div>
    </div>
  );
}
