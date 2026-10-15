import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  /** A password field gets a show/hide toggle. */
  password?: boolean;
  type?: string;
}

/** A labelled input; password fields can be shown and hidden. */
export default function TextField({ label, password = false, type = 'text', id, className = '', ...rest }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const [shown, setShown] = useState(false);
  return (
    <div className="text-field">
      <label className="form-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="text-field__control">
        <input
          {...rest}
          id={inputId}
          type={password ? (shown ? 'text' : 'password') : type}
          className={`form-input ${className}`.trim()}
        />
        {password && (
          <button
            type="button"
            className="text-field__toggle icon-btn"
            aria-label={shown ? 'Hide password' : 'Show password'}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}
