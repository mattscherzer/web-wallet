import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { addMember, createUser, fetchMembers, fetchProfiles, type MemberRow, type ProfileRow } from '../db/admin';
import { fetchWallets, insertWallet, WalletNameError, type Wallet } from '../db/wallets';
import { useAuth } from '../auth/useAuth';

/**
 * Admin dashboard. The page check below is a convenience only: what protects the data are the
 * database policies and the admin check inside the edge function.
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
  if (!profile?.isAdmin) return <p className="empty-state__text">Admins only</p>;
  return <Dashboard />;
}

function Dashboard() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [w, p, m] = await Promise.all([fetchWallets(), fetchProfiles(), fetchMembers()]);
      setWallets(w);
      setProfiles(p);
      setMembers(m);
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load the admin data:', err);
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
        <h1 className="page-header__title">Admin</h1>
      </div>
      {loadError && (
        <p role="alert" className="form-error">
          Couldn’t load everything. Check your connection and try again.
        </p>
      )}
      <WalletForm onDone={reload} />
      <UserForm wallets={wallets} onDone={reload} />
      <MemberForm wallets={wallets} profiles={profiles} onDone={reload} />
      <section aria-label="Wallets and members">
        <h2 className="entry__heading">Wallets</h2>
        <ul>
          {wallets.map((w) => (
            <li key={w.id}>
              {w.name}:{' '}
              {members
                .filter((m) => m.wallet_id === w.id)
                .map((m) => profiles.find((p) => p.id === m.user_id)?.display_name ?? 'Unknown')
                .join(', ') || 'no members'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function useAction(run: () => Promise<void>, onDone: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await run();
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setBusy(false);
  };
  return { error, busy, submit };
}

function WalletForm({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const { error, busy, submit } = useAction(async () => {
    try {
      await insertWallet(name);
    } catch (err) {
      throw err instanceof WalletNameError ? err : new Error('Couldn’t create the wallet');
    }
    setName('');
  }, onDone);
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

function UserForm({ wallets, onDone }: { wallets: Wallet[]; onDone: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [walletIds, setWalletIds] = useState<string[]>([]);
  const { error, busy, submit } = useAction(async () => {
    await createUser({ email: email.trim(), password, displayName: displayName.trim(), walletIds });
    setEmail('');
    setDisplayName('');
    setPassword('');
    setWalletIds([]);
  }, onDone);
  const toggle = (id: string) =>
    setWalletIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  return (
    <form onSubmit={submit} noValidate aria-label="Create a user">
      <h2 className="entry__heading">New user</h2>
      <div className="form-group">
        <label className="form-label" htmlFor="admin-user-email">
          Email
        </label>
        <input
          id="admin-user-email"
          type="email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="admin-user-name">
          Display name
        </label>
        <input id="admin-user-name" className="form-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="admin-user-password">
          Temporary password
        </label>
        <input
          id="admin-user-password"
          type="text"
          autoComplete="off"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <fieldset>
        <legend className="form-label">Wallets</legend>
        {wallets.map((w) => (
          <div key={w.id}>
            <input
              id={`admin-user-wallet-${w.id}`}
              type="checkbox"
              checked={walletIds.includes(w.id)}
              onChange={() => toggle(w.id)}
            />{' '}
            <label htmlFor={`admin-user-wallet-${w.id}`}>{w.name}</label>
          </div>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary" disabled={busy}>
        Create user
      </button>
    </form>
  );
}

function MemberForm({
  wallets,
  profiles,
  onDone,
}: {
  wallets: Wallet[];
  profiles: ProfileRow[];
  onDone: () => Promise<void>;
}) {
  const [userId, setUserId] = useState('');
  const [walletId, setWalletId] = useState('');
  const { error, busy, submit } = useAction(async () => {
    if (!userId || !walletId) throw new Error('Choose a person and a wallet');
    await addMember(userId, walletId);
  }, onDone);
  return (
    <form onSubmit={submit} noValidate aria-label="Add a member to a wallet">
      <h2 className="entry__heading">Add to a wallet</h2>
      <div className="form-group">
        <label className="form-label" htmlFor="admin-member-user">
          Member
        </label>
        <select id="admin-member-user" className="form-input" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Choose…</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="admin-member-wallet">
          Wallet
        </label>
        <select
          id="admin-member-wallet"
          className="form-input"
          value={walletId}
          onChange={(e) => setWalletId(e.target.value)}
        >
          <option value="">Choose…</option>
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
      <button type="submit" className="btn btn--outline" disabled={busy}>
        Add member
      </button>
    </form>
  );
}
