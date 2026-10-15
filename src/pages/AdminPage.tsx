import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { createStaff, listStaff, resetStaffPin, setStaffDisabled, type StaffMember } from '../db/admin';
import { createWallet, fetchWallets, WalletNameError, type Wallet } from '../db/wallets';
import { useAuth } from '../auth/useAuth';
import { useOwnerConfirm } from '../auth/OwnerConfirm';
import { useOptionalWallet } from '../wallet/useWallet';
import { walletInitials } from '../wallet/walletStore';
import { PIN_LENGTH, isPin } from '../auth/pin';
import BottomSheet from '../components/BottomSheet';
import TextField from '../components/TextField';

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
  if (profile?.kind !== 'owner') {
    return (
      <div className="owners-only">
        <h1 className="owners-only__title">Owners only</h1>
        <p className="entry__hint">
          Only the owner can manage wallets and staff. Ask the owner if something needs to change.
        </p>
        <Link to="/more" className="btn btn--outline">
          Back to More
        </Link>
      </div>
    );
  }
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
      <header className="admin-header">
        <Link to="/more" className="icon-btn" aria-label="Back">
          <ArrowLeft size={24} aria-hidden="true" />
        </Link>
        <h1 className="admin-header__title">Wallets and staff</h1>
      </header>
      <p className="admin-intro">
        Only owners see this page. Staff record and edit entries, and each belongs to one wallet.
      </p>
      {loadError && (
        <p role="alert" className="form-error">
          Couldn’t load everything. Check your connection and try again.
        </p>
      )}
      <h2 className="admin-heading">Wallets</h2>
      <ul className="admin-list">
        {wallets.map((w) => {
          const count = staff.filter((s) => s.wallet_id === w.id).length;
          return (
            <li key={w.id} className="admin-row admin-row--wallet">
              <span className="admin-avatar admin-avatar--wallet" aria-hidden="true">
                {walletInitials(w.name)}
              </span>
              <span className="admin-row__who">
                <span className="admin-row__name">{w.name}</span>
                <span className="admin-row__sub">{count === 0 ? 'No staff yet' : `${count} staff`}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <WalletForm
        onDone={async () => {
          await reload();
          await wallet?.refresh(); // so the wallet switcher lists the new wallet right away
        }}
      />
      {wallets.map((w) => {
        const members = staff.filter((s) => s.wallet_id === w.id);
        return (
          <section key={w.id} aria-label={`Staff of ${w.name}`}>
            <h2 className="admin-heading">{`Staff · ${w.name}`}</h2>
            {members.length > 0 && (
              <ul className="admin-list">
                {members.map((s) => (
                  <StaffRow key={s.user_id} member={s} onDone={reload} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <AddStaff wallets={wallets} onDone={reload} />
    </div>
  );
}

/** Runs an owner action: asks for the password first (once per 15 minutes), shows what went wrong. */
function useOwnerAction(run: () => Promise<void>, onDone: () => Promise<void>) {
  const confirmOwner = useOwnerConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Resolves to true when the action went through (not cancelled, not failed). */
  const go = async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    let done = false;
    try {
      if (await confirmOwner()) {
        await run();
        await onDone();
        done = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setBusy(false);
    return done;
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
    <form className="admin-form" onSubmit={submit} noValidate aria-label="Create a wallet">
      <h2 className="admin-heading">New wallet</h2>
      <TextField label="Wallet name" value={name} onChange={(e) => setName(e.target.value)} />
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

/** The Add staff button and its bottom sheet. */
function AddStaff({ wallets, onDone }: { wallets: Wallet[]; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Add staff
      </button>
      {open && (
        <BottomSheet label="Add staff" onClose={() => setOpen(false)}>
          <StaffForm
            wallets={wallets}
            onDone={onDone}
            onAdded={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </BottomSheet>
      )}
    </>
  );
}

function StaffForm({
  wallets,
  onDone,
  onAdded,
  onCancel,
}: {
  wallets: Wallet[];
  onDone: () => Promise<void>;
  onAdded: () => void;
  onCancel: () => void;
}) {
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
    void go().then((ok) => ok && onAdded());
  };
  return (
    <form onSubmit={submit} noValidate>
      <h2 className="entry__heading">Add staff</h2>
      <p className="entry__hint">
        Staff record and edit entries. They don’t need an account, only a username and a PIN.
      </p>
      <TextField
        label="Name shown in the history"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <TextField
        label="Username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextField
        label="PIN"
        inputMode="numeric"
        maxLength={PIN_LENGTH}
        autoComplete="off"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      />
      <p className="form-hint">{PIN_LENGTH} digits. Hand it over in person.</p>
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
      <button type="button" className="btn btn--outline" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function StaffRow({ member, onDone }: { member: StaffMember; onDone: () => Promise<void> }) {
  const [resetting, setResetting] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmingDisable, setConfirmingDisable] = useState(false);
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
    <li className="admin-row admin-row--staff">
      <div className="admin-row__top">
        <span className="admin-avatar" aria-hidden="true">
          {member.display_name.slice(0, 1).toUpperCase()}
        </span>
        <span className="admin-row__who">
          <span className="admin-row__name">
            {member.display_name}
            {member.disabled && <span className="admin-row__sub"> (disabled)</span>}
          </span>
          <span className="admin-row__mono">{member.username}</span>
        </span>
      </div>
      <div className="admin-row__actions">
        <button
          type="button"
          className="admin-pill"
          aria-label={`Reset PIN for ${member.display_name}`}
          onClick={() => setResetting((v) => !v)}
        >
          Reset PIN
        </button>
        <button
          type="button"
          className={`admin-pill ${member.disabled ? '' : 'admin-pill--danger'}`.trim()}
          aria-label={`${member.disabled ? 'Enable' : 'Disable'} ${member.display_name}`}
          disabled={toggle.busy}
          onClick={() => (member.disabled ? void toggle.go() : setConfirmingDisable(true))}
        >
          {member.disabled ? 'Enable' : 'Disable'}
        </button>
      </div>
      {confirmingDisable && (
        <BottomSheet label={`Disable ${member.display_name}?`} onClose={() => setConfirmingDisable(false)}>
          <h2 className="entry__heading">{`Disable ${member.display_name}?`}</h2>
          <p className="entry__hint">
            {`${member.display_name} can no longer sign in, on any phone. Entries ${member.display_name} recorded stay in the books under ${member.display_name}’s name. You can enable ${member.display_name} again later.`}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={toggle.busy}
            onClick={() => void toggle.go().then(() => setConfirmingDisable(false))}
          >
            {`Disable ${member.display_name}`}
          </button>
          <button type="button" className="btn btn--outline" onClick={() => setConfirmingDisable(false)}>
            {`Keep ${member.display_name}`}
          </button>
        </BottomSheet>
      )}
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
