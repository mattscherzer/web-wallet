import { useState, type FormEvent } from 'react';
import { ArrowLeft, Lock, TriangleAlert } from 'lucide-react';
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

  const backToUsername = () => {
    setPin('');
    setError(null);
    setStep('username');
  };

  const anotherUsername = () => {
    setPaused(null);
    setPin('');
    setError(null);
    setUsername('');
    setStep('username');
  };

  const brand = (
    <div className="login-brand">
      <span className="login-brand__mark" aria-hidden="true">
        <Lock size={28} />
      </span>
      <span className="login-brand__name">Treasury</span>
    </div>
  );

  const footer = (
    <p className="login-footer">Stays signed in on this phone until you sign out. Locks after 30 minutes without use.</p>
  );

  const tabs = (
    <div className="login-tabs" role="group" aria-label="Sign in as">
      {(['staff', 'owner'] as const).map((m) => (
        <button
          key={m}
          type="button"
          className={`login-tabs__tab${mode === m ? ' login-tabs__tab--active' : ''}`}
          aria-pressed={mode === m}
          onClick={() => switchMode(m)}
        >
          {m === 'staff' ? 'Staff' : 'Owner'}
        </button>
      ))}
    </div>
  );

  const alert = error && (
    <p role="alert" className="login-error">
      <TriangleAlert size={20} aria-hidden="true" />
      {error}
    </p>
  );

  if (mode === 'staff' && paused !== null) {
    return (
      <div className="login-page">
        {brand}
        <div className="login-body">
          <h1 className="login-title">Too many wrong tries</h1>
          <div className="login-paused" role="group" aria-label="Sign in paused">
            <TriangleAlert size={20} aria-hidden="true" />
            <div>
              <strong>Sign-in for “{name}” is paused</strong>
              <span>So nobody can keep guessing the PIN. Each new mistake after a pause makes the wait longer.</span>
            </div>
          </div>
          <div className="login-timer">
            <Countdown seconds={paused} />
            <span>until you can try again</span>
          </div>
          <p className="login-text">Don’t want to wait? Ask the owner to reset your PIN. They’ll give you a new one.</p>
          <button type="button" className="btn btn--outline" onClick={anotherUsername}>
            Use another username
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'staff' && step === 'pin') {
    const wrong = error !== null && error.startsWith('Wrong');
    return (
      <div className="login-page login-page--pin">
        <header className="login-back">
          <button type="button" className="icon-btn" aria-label="Back to username" onClick={backToUsername}>
            <ArrowLeft size={24} aria-hidden="true" />
          </button>
        </header>
        <div className="login-hello">
          <span className="login-hello__avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
          <h1 className="login-title">Hi, {name}</h1>
          <p className="login-text">{busy ? 'Checking your PIN' : `Enter your ${PIN_LENGTH}-digit PIN`}</p>
        </div>
        <PinPad value={pin} onChange={onPin} disabled={busy} invalid={wrong} status={busy ? 'Signing you in…' : null}>
          {alert}
        </PinPad>
        <button type="button" className="login-link" onClick={anotherUsername}>
          Not {name}? Use another username
        </button>
      </div>
    );
  }

  return (
    <div className="login-page">
      {brand}
      <div className="login-body">
        <div className="login-heading">
          <h1 className="login-title">Sign in</h1>
          <p className="login-text">
            {mode === 'owner'
              ? 'Owners sign in with email and password.'
              : 'Staff sign in with the username and 6-digit PIN the owner gave them.'}
          </p>
        </div>
        {tabs}
        {mode === 'owner' ? (
          <form className="login-form" onSubmit={submitOwner} noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
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
            {alert}
            <button type="submit" className="btn btn--primary" disabled={busy}>
              Sign in
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitUsername} noValidate>
            <TextField
              label="Username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              hint="This phone remembers it, so next time you only enter your PIN."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {alert}
            <button type="submit" className="btn btn--primary">
              Continue
            </button>
            <p className="login-note">Forgot your PIN? Ask the owner to reset it.</p>
          </form>
        )}
      </div>
      {footer}
    </div>
  );
}
