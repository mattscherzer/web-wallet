import { useNavigate } from 'react-router';
import { Check, Plus } from 'lucide-react';
import { useWalletBalances } from '../hooks/useWalletBalances';
import { useWallet } from '../wallet/useWallet';
import { useAuth } from '../auth/useAuth';
import { walletInitials } from '../domain/wallet';
import { formatCurrency } from '../utils/formatCurrency';
import BottomSheet from './BottomSheet';

export default function WalletSwitcher({ onClose }: { onClose: () => void }) {
  const { wallets, current, switchWallet } = useWallet();
  const navigate = useNavigate();
  const { profile } = useAuth();
  // Only owners create wallets; the database refuses everyone else.
  const canCreate = !profile || profile.kind === 'owner'; // outside a login (isolated tests) nothing is hidden
  const { balances, failed, retry } = useWalletBalances(wallets);

  const choose = (id: string) => {
    switchWallet(id);
    onClose();
    navigate('/');
  };

  return (
    <BottomSheet
      title="Wallets"
      text="Each wallet has its own accounts, categories, staff and history."
      onClose={onClose}
      showClose
    >
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
                <span className={`wallet-avatar wallet-avatar--${isCurrent ? 'current' : 'tonal'}`} aria-hidden="true">
                  {walletInitials(w.name)}
                </span>
                <span className="wallet-row__text">
                  <span className="wallet-row__name">{w.name}</span>
                  <span className="wallet-row__balance">
                    {profile ? `${profile.kind === 'owner' ? 'Owner' : 'Staff'} · ` : ''}
                    {balances ? formatCurrency(balances[w.id] ?? 0) : failed ? 'Balance unavailable' : '…'}
                  </span>
                </span>
                {isCurrent && <Check size={24} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>

      {failed && (
        <p role="alert" className="form-error">
          Couldn’t load the balances.{' '}
          <button type="button" className="wallet-sheet__retry" onClick={retry}>
            Retry
          </button>
        </p>
      )}

      {canCreate && (
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
      )}
      <p className="lead-text">
        Staff belong to one wallet and see only that one. Owners see every wallet they created.
      </p>
    </BottomSheet>
  );
}
