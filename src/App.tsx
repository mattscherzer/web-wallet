import { lazy } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { WalletProvider } from './wallet/WalletProvider';
import WalletGate from './wallet/WalletGate';
import { legacyRedirect } from './components/recordMenu';

// Routes are code-split so the initial load only pulls the dashboard.
// Layout renders the Suspense boundary, which keeps the bottom nav mounted
// while a route chunk is fetched.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RecordPage = lazy(() => import('./pages/RecordPage'));
const RecordedPage = lazy(() => import('./pages/RecordedPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const EntryPage = lazy(() => import('./pages/EntryPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const MorePage = lazy(() => import('./pages/MorePage'));
const NewWalletPage = lazy(() => import('./pages/NewWalletPage'));

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <WalletGate>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="record" element={<RecordPage />} />
              <Route path="recorded/:id" element={<RecordedPage />} />
              {['add', 'withdraw', 'transfer'].map((old) => (
                <Route key={old} path={old} element={<Navigate to={legacyRedirect(`/${old}`) ?? '/record'} replace />} />
              ))}
              <Route path="history" element={<HistoryPage />} />
              <Route path="history/:id" element={<EntryPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="more" element={<MorePage />} />
              <Route path="wallets/new" element={<NewWalletPage />} />
            </Route>
          </Routes>
        </WalletGate>
      </WalletProvider>
    </BrowserRouter>
  );
}
