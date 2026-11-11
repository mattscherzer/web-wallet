import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Check, X } from 'lucide-react';
import { WalletNameError } from '../domain/wallet';
import { useWallet } from '../wallet/useWallet';
import { useAuth } from '../auth/useAuth';
import { useOwnerConfirm } from '../auth/OwnerConfirm';
import { Field } from '../components/FilledField';

export default function NewWalletPage() {
  const { addWallet } = useWallet();
  const { profile, user } = useAuth();
  const confirmOwner = useOwnerConfirm();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (!(await confirmOwner())) {
        setSaving(false);
        return;
      }
      await addWallet(name);
      navigate('/');
    } catch (err) {
      setError(err instanceof WalletNameError ? err.message : 'Couldn’t create the wallet. Please try again.');
      setSaving(false);
    }
  };

  if (profile && profile.kind !== 'owner') return <p className="empty-state__text">Owners only</p>;

  return (
    <div className="new-wallet">
      <div className="page-header">
        <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => navigate('/')}>
          <X size={24} aria-hidden="true" />
        </button>
        <h1 className="page-header__title">New wallet</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="new-wallet__form">
        <Field
          id="wallet-name"
          label="Wallet name"
          hint="Shown to staff, on reports and on exported files."
          error={error}
        >
          <input
            id="wallet-name"
            className={`filled-field__input${error ? ' filled-field__input--error' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby="wallet-name-hint"
            aria-invalid={error ? true : undefined}
            autoFocus
          />
        </Field>

        <dl className="facts">
          <div className="facts__row">
            <dt>Currency</dt>
            <dd>Euro (€)</dd>
          </div>
          <div className="facts__row">
            <dt>You’ll be</dt>
            <dd>Owner · full access</dd>
          </div>
          {user?.email && (
            <div className="facts__row">
              <dt>Signed in as</dt>
              <dd>{user.email}</dd>
            </div>
          )}
        </dl>

        <p className="new-wallet__note">You can add staff once the wallet exists.</p>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          <Check size={20} aria-hidden="true" />
          Create wallet
        </button>
      </form>
    </div>
  );
}
