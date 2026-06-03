import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { usePin } from '../db/hooks';

interface PinModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  title?: string;
}

export default function PinModal({
  isOpen,
  onSuccess,
  onCancel,
  title = 'Enter PIN to Confirm',
}: PinModalProps) {
  const correctPin = usePin();
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setError(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError(false);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (index === 3 && value) {
      const pin = newDigits.join('');
      if (pin === correctPin) {
        onSuccess();
      } else {
        setError(true);
        setDigits(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 400);
      }
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel} id="pin-modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="pin-modal__title">{title}</h2>
        <p className="pin-modal__subtitle">
          Enter your 4-digit confirmation code
        </p>

        <div className="pin-inputs">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`pin-input${error ? ' pin-input--error' : ''}`}
              id={`pin-input-${i}`}
              autoComplete="off"
            />
          ))}
        </div>

        {error && (
          <p className="pin-modal__error">Incorrect PIN. Please try again.</p>
        )}

        <button className="pin-modal__cancel" onClick={onCancel} id="pin-cancel-btn">
          Cancel
        </button>
      </div>
    </div>
  );
}
