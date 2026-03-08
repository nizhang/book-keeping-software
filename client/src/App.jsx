import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Import from './pages/Import';
import Accounts from './pages/Accounts';
import Classes from './pages/Classes';
import OpeningBalances from './pages/OpeningBalances';
import IncomeStatement from './pages/Reports/IncomeStatement';
import BalanceSheet from './pages/Reports/BalanceSheet';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/"                  element={<Dashboard />} />
        <Route path="/transactions"      element={<Transactions />} />
        <Route path="/import"            element={<Import />} />
        <Route path="/accounts"          element={<Accounts />} />
        <Route path="/classes"           element={<Classes />} />
        <Route path="/opening-balances" element={<OpeningBalances />} />
        <Route path="/reports/income"    element={<IncomeStatement />} />
        <Route path="/reports/balance"   element={<BalanceSheet />} />
      </Route>
    </Routes>
  );
}
