import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useDialogFocus } from '../components/useDialogFocus';
import { Field } from '../components/FilledField';

interface ConfirmDialogProps {
  password: string;
  onPassword: (v: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

/** The "Confirm your password" dialog: markup and local state only; checking the password is the provider's job. */
export default function ConfirmDialog({ password, onPassword, error, busy, onSubmit, onCancel }: ConfirmDialogProps) {
  const [shown, setShown] = useState(false);
  const dialogRef = useDialogFocus<HTMLFormElement>(onCancel);
  return (
    <div className="modal-overlay modal-overlay--top">
      <form
        ref={dialogRef}
        tabIndex={-1}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-confirm-title"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="dialog-head">
          <h2 id="owner-confirm-title" className="title-lg">
            Confirm your password
          </h2>
          <p className="lead-text">This is for owners only. You won’t be asked again for 15 minutes.</p>
        </div>
        <Field id="owner-confirm-password" label="Password" error={error}>
          <span className="filled-field__wrap">
            <input
              id="owner-confirm-password"
              type={shown ? 'text' : 'password'}
              className={`filled-field__input${error ? ' filled-field__input--error' : ''}`}
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              aria-invalid={error ? true : undefined}
              value={password}
              onChange={(e) => onPassword(e.target.value)}
            />
            <button
              type="button"
              className="filled-field__toggle"
              aria-label={shown ? 'Hide password' : 'Show password'}
              aria-pressed={shown}
              onClick={() => setShown((v) => !v)}
            >
              {shown ? <EyeOff size={24} aria-hidden="true" /> : <Eye size={24} aria-hidden="true" />}
            </button>
          </span>
        </Field>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Confirm
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </form>
    </div>
  );
}
