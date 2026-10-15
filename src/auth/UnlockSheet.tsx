import { useState, type FormEvent } from 'react';
import { Lock, X } from 'lucide-react';
import BottomSheet from '../components/BottomSheet';
import Countdown from '../components/Countdown';
import PinPad from '../components/PinPad';
import TextField from '../components/TextField';
import type { AccessResult } from './authContext';
import { PIN_LENGTH } from './pin';
import { readLastStaff } from './staffLogin';
import { useAuth } from './useAuth';

type Problem = Exclude<AccessResult, { ok: true }> | null;

const COULDNT_CHECK = 'Couldn’t check. Check your connection and try again.';

/** Asks whoever holds the phone to prove who they are again: staff by PIN, owners by password. */
export default function UnlockSheet({ onClose }: { onClose: () => void }) {
  const { profile, unlock, signOut } = useAuth();
  const isOwner = profile?.kind === 'owner';
  const name = isOwner ? (profile?.displayName ?? '') : readLastStaff();
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  const attempt = async (secret: string) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const result = await unlock(secret);
    setBusy(false);
    if (result.ok) {
      onClose();
    } else {
      setPin('');
      setPassword('');
      setProblem(result);
    }
  };
  const onPin = (next: string) => {
    setPin(next);
    if (next.length === PIN_LENGTH) void attempt(next);
  };
  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    if (password) void attempt(password);
  };

  if (problem?.kind === 'paused') {
    return (
      <BottomSheet label="Unlock to make changes" onClose={onClose} className="unlock-sheet">
        <h2 className="unlock-sheet__title">Unlock for “{name}” is paused</h2>
        <p className="unlock-sheet__text">
          So nobody can keep guessing the PIN. You can still look at balances and history.
        </p>
        <Countdown seconds={problem.retryAfter} />
        <p className="unlock-sheet__text">until you can try again</p>
        <p className="unlock-sheet__text">Don’t want to wait? Ask the owner to reset your PIN.</p>
        <button type="button" className="btn btn--outline" onClick={onClose}>
          Back to viewing
        </button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet label="Unlock to make changes" onClose={onClose} className="unlock-sheet">
      <div className="unlock-sheet__head">
        <span className="unlock-sheet__icon" aria-hidden="true">
          <Lock size={24} />
        </span>
        <button type="button" className="icon-btn" aria-label="Close, keep viewing" onClick={onClose}>
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      <h2 className="unlock-sheet__title">Unlock to make changes</h2>
      <p className="unlock-sheet__text">
        {isOwner ? `Hi, ${name}. Enter your password.` : `Hi, ${name}. Enter your ${PIN_LENGTH}-digit PIN.`}
      </p>
      {problem && (
        <p role="alert" className="form-error">
          {problem.kind === 'wrong' ? (isOwner ? 'Wrong password' : 'Wrong PIN') : COULDNT_CHECK}
        </p>
      )}
      {isOwner ? (
        <form onSubmit={submitPassword} noValidate>
          <TextField
            label="Password"
            password
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Unlock
          </button>
          <p className="unlock-sheet__text">Locks again after 30 minutes without use.</p>
        </form>
      ) : (
        <PinPad value={pin} onChange={onPin} disabled={busy} />
      )}
      <button type="button" className="unlock-sheet__link" onClick={() => void signOut()}>
        Not {name}? Sign out
      </button>
    </BottomSheet>
  );
}
