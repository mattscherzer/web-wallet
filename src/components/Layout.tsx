import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="app-layout">
      <main className="page-container">
        <Suspense
          fallback={
            <div className="route-fallback" role="status" aria-label="Loading">
              <span className="route-fallback__spinner" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
