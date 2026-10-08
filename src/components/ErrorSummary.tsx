import type { Ref } from 'react';
import type { FieldError } from '../utils/recordForm';

interface ErrorSummaryProps {
  errors: FieldError[];
  /** Id of the input for each field, so a link can take you to it. */
  fieldIds: Record<FieldError['field'], string>;
  ref?: Ref<HTMLDivElement>;
}

/** Lists every problem at the top of a form, each linking to its field. Takes focus when it appears. */
export default function ErrorSummary({ errors, fieldIds, ref }: ErrorSummaryProps) {
  const focusField = (id: string) => {
    const el = document.getElementById(id);
    el?.focus();
    el?.scrollIntoView?.({ block: 'center' });
  };
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="error-summary" aria-labelledby="error-summary-title">
      <h2 id="error-summary-title" className="error-summary__title">
        {errors.length === 1 ? 'There is 1 problem' : `There are ${errors.length} problems`}
      </h2>
      <ul className="error-summary__list">
        {errors.map((e) => (
          <li key={e.field}>
            <a
              href={`#${fieldIds[e.field]}`}
              onClick={(ev) => {
                ev.preventDefault();
                focusField(fieldIds[e.field]);
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
