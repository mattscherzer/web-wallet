import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { WalletProvider } from './wallet/WalletContext';
import WalletGate from './wallet/WalletGate';

// Routes are code-split so the initial load only pulls the dashboard.
// Layout renders the Suspense boundary, which keeps the bottom nav mounted
// while a route chunk is fetched.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AddMoneyPage = lazy(() => import('./pages/AddMoneyPage'));
const AddExpensePage = lazy(() => import('./pages/AddExpensePage'));
const TransferPage = lazy(() => import('./pages/TransferPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
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
              <Route path="add" element={<AddMoneyPage />} />
              <Route path="withdraw" element={<AddExpensePage />} />
              <Route path="transfer" element={<TransferPage />} />
              <Route path="history" element={<HistoryPage />} />
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
