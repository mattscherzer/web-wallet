import type { ReactNode } from 'react';
import { Delete } from 'lucide-react';
import LoadingIndicator from './LoadingIndicator';
import { PIN_LENGTH } from '../domain/pin';

interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  status?: string | null;
  children?: ReactNode;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function PinPad({
  value,
  onChange,
  disabled = false,
  invalid = false,
  status = null,
  children,
}: PinPadProps) {
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
          <LoadingIndicator />
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
