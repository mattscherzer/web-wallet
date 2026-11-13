import type { CSSProperties } from 'react';
import { matchPath, useLocation } from 'react-router';
import { HISTORY_PATH, NAV_ITEMS } from './navItems';

// One pulse lasts 8 steps, so later shapes wrap round instead of sitting still for seconds.
const STAGGER_STEPS = 8;

/** Hands out 0, 1, 2…: each shape starts its pulse one step after the one drawn before it. */
const stagger = () => {
  let count = 0;
  return () => count++ % STAGGER_STEPS;
};

function Bone({
  w,
  h,
  r,
  i,
  className = '',
}: {
  w: number | string;
  h: number;
  r: number;
  i: number;
  className?: string;
}) {
  return (
    <span
      className={`skeleton skeleton-bone ${className}`}
      style={{ width: w, height: h, borderRadius: r, '--i': i } as CSSProperties}
    />
  );
}

/** Rows grouped like the loaded lists: round outer corners, small inner ones. */
function RowGroup({ rows, tall, next }: { rows: number; tall?: boolean; next: () => number }) {
  return (
    <div className="segmented-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, n) => {
        return (
          <div className={`account-card skeleton-row${tall ? ' skeleton-row--tall' : ''}`} key={n}>
            <Bone w={40} h={40} r={20} i={next()} />
            {tall ? (
              <div className="skeleton-row__text">
                <Bone w={120} h={16} r={8} i={next()} />
                <Bone w={150} h={12} r={6} i={next()} />
              </div>
            ) : (
              <Bone w={110} h={16} r={8} i={next()} />
            )}
            <span className="skeleton-row__gap" />
            <Bone w={64} h={16} r={8} i={next()} />
          </div>
        );
      })}
    </div>
  );
}

/** The Overview while its balances load. */
export function OverviewSkeleton() {
  const next = stagger();
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="balance-hero skeleton-hero" aria-hidden="true">
        <Bone w={120} h={12} r={6} i={next()} className="skeleton-bone--on-hero" />
        <Bone w={200} h={40} r={12} i={next()} className="skeleton-bone--on-hero" />
        <Bone w={240} h={12} r={6} i={next()} className="skeleton-bone--on-hero" />
      </div>
      <div className="skeleton-title" aria-hidden="true">
        <Bone w={70} h={14} r={8} i={next()} />
      </div>
      <RowGroup rows={3} next={next} />
      <div className="account-card account-card--reserve skeleton-reserve" aria-hidden="true">
        <Bone w={40} h={40} r={20} i={next()} className="skeleton-bone--on-surface" />
        <div className="skeleton-row__text">
          <Bone w={120} h={16} r={8} i={next()} className="skeleton-bone--on-surface" />
          <Bone w={180} h={12} r={6} i={next()} className="skeleton-bone--on-surface" />
        </div>
      </div>
      <div className="skeleton-title skeleton-title--section" aria-hidden="true">
        <Bone w={110} h={14} r={8} i={next()} />
      </div>
      <RowGroup rows={2} tall next={next} />
    </div>
  );
}

/** History while its entries load. The page title is real, so only the data is drawn as shapes. */
export function HistorySkeleton() {
  const next = stagger();
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="skeleton-history">
      <div aria-hidden="true">
        <Bone w="100%" h={56} r={28} i={next()} />
      </div>
      <div className="skeleton-pills" aria-hidden="true">
        <Bone w={84} h={32} r={8} i={next()} />
        <Bone w={96} h={32} r={8} i={next()} />
        <Bone w={72} h={32} r={8} i={next()} />
      </div>
      <div aria-hidden="true">
        <Bone w={150} h={14} r={8} i={next()} />
      </div>
      <RowGroup rows={6} tall next={next} />
    </div>
  );
}

/** Whatever page the address will open, while its code loads. */
export function RouteSkeleton() {
  const { pathname } = useLocation();
  return matchPath(HISTORY_PATH, pathname) ? <HistorySkeleton /> : <OverviewSkeleton />;
}

/** The whole screen before the wallet is known: top bar, Overview and navigation bar as shapes. */
export function AppShellSkeleton() {
  const next = stagger();
  return (
    <div className="app-layout">
      <main className="page-container">
        <header className="app-bar skeleton-app-bar" aria-hidden="true">
          <Bone w={36} h={36} r={18} i={next()} />
          <div className="skeleton-row__text">
            <Bone w={170} h={18} r={8} i={next()} />
            <Bone w={110} h={12} r={6} i={next()} />
          </div>
          <span className="skeleton-row__gap" />
          <Bone w={48} h={48} r={24} i={next()} />
        </header>
        <OverviewSkeleton />
      </main>
      <div className="bottom-nav" aria-hidden="true">
        {NAV_ITEMS.map(({ to }) => (
          <span className="bottom-nav__item" key={to}>
            <Bone w={56} h={32} r={16} i={next()} />
          </span>
        ))}
      </div>
    </div>
  );
}
