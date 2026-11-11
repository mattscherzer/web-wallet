import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { PIN_LENGTH } from '../domain/pin';

/** A problem message with its icon, shown under a field or a form. */
export function InlineError({ message }: { message: string | null }) {
  return (
    message && (
      <p role="alert" className="inline-error">
        <CircleAlert size={18} aria-hidden="true" />
        {message}
      </p>
    )
  );
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  /** The input (and anything drawn on it); give it the `filled-field__input` class. */
  children: ReactNode;
}

/** Label, input, hint and error in the filled style used by sheets, dialogs and forms. */
export function Field({ id, label, hint, error = null, children }: FieldProps) {
  return (
    <div className="filled-field">
      <label className="filled-field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="filled-field__hint">
          {hint}
        </p>
      )}
      <InlineError message={error} />
    </div>
  );
}

/** One real input (so typing, paste and screen readers just work) drawn as PIN_LENGTH boxes. */
export function PinInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <span className="pin-field">
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`pin-field__cell${i === Math.min(value.length, PIN_LENGTH - 1) ? ' pin-field__cell--active' : ''}`}
        >
          {value[i]}
        </span>
      ))}
      <input
        id={id}
        className="pin-field__input"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
      />
    </span>
  );
}
