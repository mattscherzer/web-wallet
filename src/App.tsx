import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import AddMoneyPage from './pages/AddMoneyPage';
import AddExpensePage from './pages/AddExpensePage';
import TransferPage from './pages/TransferPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="add" element={<AddMoneyPage />} />
          <Route path="withdraw" element={<AddExpensePage />} />
          <Route path="transfer" element={<TransferPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
