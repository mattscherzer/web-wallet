import { Suspense } from 'react';
import { Outlet } from 'react-router';
import BottomNav from './BottomNav';
import { RecordFab } from './RecordFab';
import AppBar from './AppBar';
import { RouteSkeleton } from './LoadingSkeletons';

export default function Layout() {
  return (
    <div className="app-layout">
      <main className="page-container">
        <AppBar />
        <Suspense fallback={<RouteSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <RecordFab />
      <BottomNav />
    </div>
  );
}
