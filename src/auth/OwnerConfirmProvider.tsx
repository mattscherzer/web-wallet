import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useUnlock } from './unlockContext';
import { OWNER_CONFIRM_MS, OwnerConfirmContext, type Confirm } from './ownerConfirmContext';
import { checkOwnerPassword } from '../db/ownerPassword';
import { useAuth } from './useAuth';
import ConfirmDialog from '../components/ConfirmDialog';

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
        <ConfirmDialog
          password={password}
          onPassword={setPassword}
          error={error}
          busy={busy}
          onSubmit={submit}
          onCancel={() => settle(false)}
        />
      )}
    </OwnerConfirmContext.Provider>
  );
}
