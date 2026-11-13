import { Suspense } from 'react';
import { Outlet } from 'react-router';
import BottomNav from './BottomNav';
import { RecordFab } from './RecordFab';
import { RouteSkeleton } from './LoadingSkeletons';

export default function Layout() {
  return (
    <div className="app-layout">
      <main className="page-container">
        <Suspense fallback={<RouteSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <RecordFab />
      <BottomNav />
    </div>
  );
}
