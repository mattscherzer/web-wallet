import { useState, type FormEvent } from 'react';
import Countdown from '../components/Countdown';
import PinPad from '../components/PinPad';
import TextField from '../components/TextField';
import { PIN_LENGTH } from './pin';
import { readLastStaff } from './staffLogin';
import { useAuth } from './useAuth';

export { LAST_STAFF_KEY } from './staffLogin';

export default function LoginPage() {
  const { signIn, signInStaff } = useAuth();
  const [mode, setMode] = useState<'staff' | 'owner'>('staff');
  const [username, setUsername] = useState(readLastStaff);
  // A phone that remembers the username goes straight to the PIN pad.
  const [step, setStep] = useState<'username' | 'pin'>(() => (readLastStaff() ? 'pin' : 'username'));
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: 'staff' | 'owner') => {
    setMode(next);
    setError(null);
  };

  const name = username.trim().toLowerCase();

  const submitUsername = (e: FormEvent) => {
    e.preventDefault();
    if (!name) return setError('Enter your username');
    setError(null);
    setStep('pin');
  };

  const attempt = async (digits: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await signInStaff(name, digits);
    setBusy(false);
    if (result.ok) return;
    setPin('');
    if (result.kind === 'paused') setPaused(result.retryAfter);
    else setError(result.kind === 'wrong' ? 'Wrong username or PIN' : 'Could not sign in. Try again.');
  };
  const onPin = (next: string) => {
    setPin(next);
    if (next.length === PIN_LENGTH) void attempt(next);
  };

  const submitOwner = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const problem = await signIn(email, password);
    if (problem) setError(problem);
    setBusy(false);
  };

  const anotherUsername = () => {
    setPaused(null);
    setPin('');
    setError(null);
    setUsername('');
    setStep('username');
  };

  let body;
  if (mode === 'owner') {
    body = (
      <form className="login-card__form" onSubmit={submitOwner} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          password
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="login-card__error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Sign in
        </button>
      </form>
    );
  } else if (paused !== null) {
    body = (
      <div className="login-card__form">
        <h1 className="login-card__title">Sign in paused</h1>
        <p className="login-card__text">Sign-in for “{name}” is paused</p>
        <p className="login-card__text">
          So nobody can keep guessing the PIN. Each new mistake after a pause makes the wait longer.
        </p>
        <Countdown seconds={paused} />
        <p className="login-card__text">until you can try again</p>
        <p className="login-card__text">Don’t want to wait? Ask the owner to reset your PIN. They’ll give you a new one.</p>
        <button type="button" className="btn btn--outline" onClick={anotherUsername}>
          Use another username
        </button>
      </div>
    );
  } else if (step === 'username') {
    body = (
      <form className="login-card__form" onSubmit={submitUsername} noValidate>
        <TextField
          label="Username"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {error && (
          <p role="alert" className="login-card__error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary">
          Continue
        </button>
      </form>
    );
  } else {
    body = (
      <div className="login-card__form">
        <h1 className="login-card__title">Hi, {name}</h1>
        <p className="login-card__text">Enter your {PIN_LENGTH}-digit PIN.</p>
        {error && (
          <p role="alert" className="login-card__error">
            {error}
          </p>
        )}
        {busy && (
          <p role="status" aria-label="Checking" className="login-card__text">
            Checking…
          </p>
        )}
        <PinPad value={pin} onChange={onPin} disabled={busy} />
        <button
          type="button"
          className="unlock-sheet__link"
          onClick={() => {
            setStep('username');
            setPin('');
            setError(null);
          }}
        >
          Not {name}?
        </button>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
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
        {body}
      </div>
    </div>
  );
}
