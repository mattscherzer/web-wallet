import { useState, type FormEvent } from 'react';
import { PIN_LENGTH, isPin } from './pin';
import { useAuth } from './useAuth';

/** The staff username used last on this device, so staff only type their PIN. */
export const LAST_STAFF_KEY = 'treasury.lastStaffUsername';

function readLastStaff(): string {
  try {
    return window.localStorage.getItem(LAST_STAFF_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function LoginPage() {
  const { signIn, signInStaff } = useAuth();
  const [mode, setMode] = useState<'staff' | 'owner'>('staff');
  const [username, setUsername] = useState(readLastStaff);
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: 'staff' | 'owner') => {
    setMode(next);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (mode === 'staff') {
      if (!username.trim()) return setError('Enter your username');
      if (!isPin(pin)) return setError(`Your PIN is ${PIN_LENGTH} digits`);
    }
    setBusy(true);
    const problem = mode === 'staff' ? await signInStaff(username, pin) : await signIn(email, password);
    if (problem) {
      setError(problem);
      if (mode === 'staff') setPin('');
    } else if (mode === 'staff') {
      try {
        window.localStorage.setItem(LAST_STAFF_KEY, username.trim().toLowerCase());
      } catch {
        // Storage blocked: the username just isn't remembered.
      }
    }
    setBusy(false);
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-card__logo">
          <span className="login-card__logo-text">Treasury</span>
        </div>
        <div className="login-card__tabs" role="group" aria-label="Sign in as">
          <button
            type="button"
            className={`filter-pill${mode === 'staff' ? ' filter-pill--active' : ''}`}
            aria-pressed={mode === 'staff'}
            onClick={() => switchMode('staff')}
          >
            Staff
          </button>
          <button
            type="button"
            className={`filter-pill${mode === 'owner' ? ' filter-pill--active' : ''}`}
            aria-pressed={mode === 'owner'}
            onClick={() => switchMode('owner')}
          >
            Owner
          </button>
        </div>
        {mode === 'staff' ? (
          <>
            <div className="login-card__field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                className="form-input"
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="login-card__field">
              <label htmlFor="login-pin">PIN</label>
              <input
                id="login-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={PIN_LENGTH}
                className="form-input"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </>
        ) : (
          <>
            <div className="login-card__field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="login-card__field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="login-card__error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Sign in
        </button>
      </form>
    </div>
  );
}
