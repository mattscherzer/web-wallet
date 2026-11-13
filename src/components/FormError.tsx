import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

export default function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="form-error">
      <TriangleAlert size={20} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
