import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useUnlock } from './unlockContext';
import { OWNER_CONFIRM_MS, OwnerConfirmContext, type Confirm } from './ownerConfirmContext';
import { checkOwnerPassword } from './passwordCheck';
import { useAuth } from './useAuth';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function OwnerConfirmProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { openUnlock } = useUnlock();
  const latest = useRef({ auth, openUnlock });
  useEffect(() => {
    latest.current = { auth, openUnlock };
  });
  const confirmedUntil = useRef(0);
  const waiting = useRef<((ok: boolean) => void)[]>([]);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const settle = useCallback((ok: boolean) => {
    for (const resolve of waiting.current.splice(0)) resolve(ok);
    setAsking(false);
    setPassword('');
    setError(null);
  }, []);

  // Locking ends the 15-minute window: after an unlock the next owner action asks for the password again.
  useEffect(() => {
    if (auth.locked) confirmedUntil.current = 0;
  }, [auth.locked]);

  const confirm = useCallback<Confirm>(async () => {
    // An action can start a moment before the login has finished loading.
    while (latest.current.auth.status === 'loading') await wait(20);
    if (latest.current.auth.profile?.kind !== 'owner') return false;
    // View only: unlock first, then try again.
    if (latest.current.auth.locked) {
      latest.current.openUnlock();
      return false;
    }
    if (Date.now() < confirmedUntil.current) return true;
    return new Promise<boolean>((resolve) => {
      waiting.current.push(resolve);
      setAsking(true);
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const email = auth.user?.email;
    if (busy || !email) return;
    setBusy(true);
    setError(null);
    const ok = await checkOwnerPassword(email, password).catch(() => false);
    setBusy(false);
    if (!ok) {
      setError('That password isn’t right');
      return;
    }
    confirmedUntil.current = Date.now() + OWNER_CONFIRM_MS;
    settle(true);
  };

  return (
    <OwnerConfirmContext.Provider value={confirm}>
      {children}
      {asking && (
        <div className="modal-overlay">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm your password"
            onSubmit={submit}
            noValidate
          >
            <h2 className="modal__title">Confirm your password</h2>
            <p className="form-hint">This is for owners only. You won’t be asked again for 15 minutes.</p>
            <div className="form-group">
              <label className="form-label" htmlFor="owner-confirm-password">
                Password
              </label>
              <input
                id="owner-confirm-password"
                type="password"
                className="form-input"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn--primary" disabled={busy}>
              Confirm
            </button>
            <button type="button" className="btn btn--outline" onClick={() => settle(false)}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </OwnerConfirmContext.Provider>
  );
}
