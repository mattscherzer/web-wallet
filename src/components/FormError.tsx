import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

/** The one inline error banner: a warning icon and what happened. */
export default function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="form-error">
      <TriangleAlert size={20} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
