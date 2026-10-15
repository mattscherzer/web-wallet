import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createStaff, listStaff, resetStaffPin, setStaffDisabled, type StaffMember } from '../db/admin';
import { createWallet, fetchWallets, WalletNameError, type Wallet } from '../db/wallets';
import { useAuth } from '../auth/useAuth';
import { useOwnerConfirm } from '../auth/OwnerConfirm';
import { useOptionalWallet } from '../wallet/useWallet';
import { PIN_LENGTH, isPin } from '../auth/pin';

/**
 * Wallets and staff, for owners. The page check below is a convenience only: what protects the data are the
 * database policies and the owner check inside the staff-admin function.
 */
export default function AdminPage() {
  const { status, profile } = useAuth();
  if (status === 'loading') {
    return (
      <p role="status" className="empty-state__text">
        Loading…
      </p>
    );
  }
  if (profile?.kind !== 'owner') return <p className="empty-state__text">Owners only</p>;
  return <Dashboard />;
}

const PIN_PROBLEM = `The PIN must be exactly ${PIN_LENGTH} digits`;

function Dashboard() {
  const wallet = useOptionalWallet();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const w = await fetchWallets();
      const lists = await Promise.all(w.map((wallet) => listStaff(wallet.id).catch(() => [] as StaffMember[])));
      setWallets(w);
      setStaff([...new Map(lists.flat().map((s) => [s.user_id, s])).values()]);
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load wallets and staff:', err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void reload();
  }, [reload]);

  return (
    <div className="admin">
      <div className="page-header">
        <h1 className="page-header__title">Wallets and staff</h1>
      </div>
      {loadError && (
        <p role="alert" className="form-error">
          Couldn’t load everything. Check your connection and try again.
        </p>
      )}
      <WalletForm
        onDone={async () => {
          await reload();
          await wallet?.refresh(); // so the wallet switcher lists the new wallet right away
        }}
      />
      <StaffForm wallets={wallets} onDone={reload} />
      <section aria-label="Staff">
        <h2 className="entry__heading">Staff</h2>
        {wallets.map((w) => {
          const members = staff.filter((s) => s.wallet_id === w.id);
          return (
            <div key={w.id}>
              <h3 className="entry__hint">{w.name}</h3>
              {members.length === 0 ? (
                <p className="entry__hint">No staff yet</p>
              ) : (
                <ul>
                  {members.map((s) => (
                    <StaffRow key={s.user_id} member={s} onDone={reload} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

/** Runs an owner action: asks for the password first (once per 15 minutes), shows what went wrong. */
function useOwnerAction(run: () => Promise<void>, onDone: () => Promise<void>) {
  const confirmOwner = useOwnerConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (await confirmOwner()) {
        await run();
        await onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setBusy(false);
  };
  return { error, setError, busy, go };
}

function WalletForm({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const { error, busy, go } = useOwnerAction(async () => {
    try {
      await createWallet(name);
    } catch (err) {
      throw err instanceof WalletNameError ? err : new Error('Couldn’t create the wallet');
    }
    setName('');
  }, onDone);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void go();
  };
  return (
    <form onSubmit={submit} noValidate aria-label="Create a wallet">
      <h2 className="entry__heading">New wallet</h2>
      <div className="form-group">
        <label className="form-label" htmlFor="admin-wallet-name">
          Wallet name
        </label>
        <input id="admin-wallet-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary" disabled={busy}>
        Create wallet
      </button>
    </form>
  );
}

function StaffForm({ wallets, onDone }: { wallets: Wallet[]; onDone: () => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [walletId, setWalletId] = useState('');
  const chosen = walletId || wallets[0]?.id || '';
  const { error, setError, busy, go } = useOwnerAction(async () => {
    await createStaff({ walletId: chosen, username: username.trim(), displayName: displayName.trim(), pin });
    setUsername('');
    setDisplayName('');
    setPin('');
  }, onDone);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isPin(pin)) return setError(PIN_PROBLEM);
    void go();
  };
  return (
    <form onSubmit={submit} noValidate aria-label="Add staff">
      <h2 className="entry__heading">Add staff</h2>
      <div className="form-group">
        <label className="form-label" htmlFor="staff-username">
          Username
        </label>
        <input
          id="staff-username"
          className="form-input"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="staff-display">
          Display name
        </label>
        <input
          id="staff-display"
          className="form-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="staff-pin">
          PIN
        </label>
        <input
          id="staff-pin"
          className="form-input"
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <p className="form-hint">{PIN_LENGTH} digits. Hand it over in person.</p>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="staff-wallet">
          Wallet
        </label>
        <select id="staff-wallet" className="form-input" value={chosen} onChange={(e) => setWalletId(e.target.value)}>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary" disabled={busy || !chosen}>
        Add staff
      </button>
    </form>
  );
}

function StaffRow({ member, onDone }: { member: StaffMember; onDone: () => Promise<void> }) {
  const [resetting, setResetting] = useState(false);
  const [pin, setPin] = useState('');
  const toggle = useOwnerAction(() => setStaffDisabled(member.user_id, !member.disabled), onDone);
  const reset = useOwnerAction(async () => {
    await resetStaffPin(member.user_id, pin);
    setPin('');
    setResetting(false);
  }, onDone);
  const savePin = (e: FormEvent) => {
    e.preventDefault();
    if (!isPin(pin)) return reset.setError(PIN_PROBLEM);
    void reset.go();
  };
  return (
    <li>
      <strong>{member.display_name}</strong> <span className="entry__hint">{member.username}</span>
      {member.disabled && <span className="entry__hint"> (disabled)</span>}
      <div>
        <button
          type="button"
          className="btn btn--outline"
          aria-label={`Reset PIN for ${member.display_name}`}
          onClick={() => setResetting((v) => !v)}
        >
          Reset PIN
        </button>{' '}
        <button
          type="button"
          className="btn btn--outline"
          aria-label={`${member.disabled ? 'Enable' : 'Disable'} ${member.display_name}`}
          disabled={toggle.busy}
          onClick={() => void toggle.go()}
        >
          {member.disabled ? 'Enable' : 'Disable'}
        </button>
      </div>
      {resetting && (
        <form onSubmit={savePin} noValidate>
          <label className="form-label" htmlFor={`pin-${member.user_id}`}>
            {`New PIN for ${member.display_name}`}
          </label>
          <input
            id={`pin-${member.user_id}`}
            className="form-input"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="btn btn--primary" disabled={reset.busy}>
            Save PIN
          </button>
        </form>
      )}
      {(toggle.error || reset.error) && (
        <p role="alert" className="form-error">
          {toggle.error ?? reset.error}
        </p>
      )}
    </li>
  );
}
