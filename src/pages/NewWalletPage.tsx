import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { WalletNameError } from '../db/wallets';
import { useWallet } from '../wallet/useWallet';

export default function NewWalletPage() {
  const { addWallet } = useWallet();
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
      await addWallet(name);
      navigate('/');
    } catch (err) {
      setError(err instanceof WalletNameError ? err.message : 'Couldn’t create the wallet. Please try again.');
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => navigate('/')}>
          <X size={24} aria-hidden="true" />
        </button>
        <h1 className="page-header__title">New wallet</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="wallet-name">Wallet name</label>
          <input
            id="wallet-name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby="wallet-name-hint"
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          <p id="wallet-name-hint" className="form-hint">Shown to members, on reports and on exported files.</p>
        </div>

        {error && (
          <p role="alert" className="form-error">{error}</p>
        )}

        <button type="submit" className="btn btn--primary" disabled={saving}>
          Create wallet
        </button>
      </form>
    </>
  );
}
