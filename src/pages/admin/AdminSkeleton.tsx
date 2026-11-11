import type { CSSProperties } from 'react';
import AdminHeader from './AdminHeader';

function SkeletonRows({ count, actions }: { count: number; actions?: boolean }) {
  return (
    <ul className="card-list">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} style={{ '--i': i } as CSSProperties}>
          <div className="list-row">
            <span className="skeleton admin-skeleton__avatar" />
            <span className="list-row__text">
              <span className="skeleton admin-skeleton__line admin-skeleton__line--name" />
              <span className="skeleton admin-skeleton__line admin-skeleton__line--sub" />
            </span>
          </div>
          {actions && (
            <div className="admin-actions">
              <span className="skeleton admin-skeleton__button" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Same shapes as the loaded page, so nothing jumps when the data arrives. */
export default function AdminSkeleton() {
  return (
    <div className="admin" role="status" aria-busy="true" aria-label="Loading wallets and staff">
      <AdminHeader />
      <span className="skeleton admin-skeleton__title" />
      <SkeletonRows count={3} />
      <span className="skeleton admin-skeleton__title" />
      <SkeletonRows count={3} actions />
    </div>
  );
}
