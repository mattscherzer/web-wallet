import { useState, type FormEvent } from 'react';
import { useAuth } from './useAuth';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const problem = await signIn(email, password);
    if (problem) setError(problem);
    setBusy(false);
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-card__logo">
          <span className="login-card__logo-text">Treasury</span>
        </div>
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
