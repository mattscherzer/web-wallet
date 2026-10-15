import type { ReactNode } from 'react';
import { Delete } from 'lucide-react';
import { Loader } from 'lucide-react';
import { PIN_LENGTH } from '../auth/pin';

interface PinPadProps {
  value: string;
  /** Called with the new digits; at PIN_LENGTH digits the owner of this pad submits. */
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Dots turn red after a wrong PIN. */
  invalid?: boolean;
  /** Shown in place of the keys while the PIN is being checked. */
  status?: string | null;
  /** Rendered under the dots, e.g. an error message. */
  children?: ReactNode;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Six dots and a 3×4 number pad for a staff PIN. */
export default function PinPad({ value, onChange, disabled = false, invalid = false, status = null, children }: PinPadProps) {
  const add = (digit: string) => {
    if (!disabled && value.length < PIN_LENGTH) onChange(value + digit);
  };
  return (
    <div className="pin-pad">
      <div className="pin-pad__display">
        <div
          className={`pin-dots${invalid ? ' pin-dots--invalid' : ''}`}
          role="img"
          aria-label={`${value.length} of ${PIN_LENGTH} digits entered`}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={`pin-dots__dot${i < value.length ? ' pin-dots__dot--filled' : ''}`} />
          ))}
        </div>
        {children}
      </div>
      {status && (
        <p role="status" aria-label="Checking" className="pin-pad__status">
          <Loader size={32} aria-hidden="true" />
          {status}
        </p>
      )}
      <div className="pin-pad__keys" hidden={Boolean(status)}>
        {KEYS.map((k) => (
          <button key={k} type="button" className="pin-pad__key" disabled={disabled} onClick={() => add(k)}>
            {k}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" className="pin-pad__key" disabled={disabled} onClick={() => add('0')}>
          0
        </button>
        <button
          type="button"
          className="pin-pad__key pin-pad__key--delete"
          aria-label="Delete last digit"
          disabled={disabled || value.length === 0}
          onClick={() => onChange(value.slice(0, -1))}
        >
          <Delete size={24} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
