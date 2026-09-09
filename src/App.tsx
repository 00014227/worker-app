import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
const ShipmentsPage = lazy(() => import('./pages/ShipmentsPage'));
const NewShipmentPage = lazy(() => import('./pages/NewShipmentPage'));
const ShipmentDetailPage = lazy(() => import('./pages/ShipmentDetailPage'));
const EditShipmentPage = lazy(() => import('./pages/EditShipmentPage'));
const RateRequestsPage = lazy(() => import('./pages/RateRequestsPage'));
const NewRateRequestPage = lazy(() => import('./pages/NewRateRequestPage'));
const ContractorsPage = lazy(() => import('./pages/ContractorsPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const TelegramAccountsPage = lazy(() => import('./pages/TelegramAccountsPage'));
const RateRequestDetailPage = lazy(
  () => import('./pages/RateRequestDetailPage'),
);
const MapPage = lazy(() => import('./pages/MapPage'));
const AiDealPage = lazy(() => import('./pages/AiDealPage'));
const TariffSourcesPage = lazy(() => import('./pages/TariffSourcesPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const CounterpartyCheckPage = lazy(
  () => import('./pages/CounterpartyCheckPage'),
);
const ContractDiffPage = lazy(() => import('./pages/ContractDiffPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
          <Route path="/shipments/new" element={<NewShipmentPage />} />
          <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
          <Route path="/shipments/:id/edit" element={<EditShipmentPage />} />
          <Route path="/rate-requests" element={<RateRequestsPage />} />
          <Route path="/rate-requests/new" element={<NewRateRequestPage />} />
          <Route
            path="/rate-requests/:id"
            element={<RateRequestDetailPage />}
          />
          <Route path="/contractors" element={<ContractorsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/telegram-accounts" element={<TelegramAccountsPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/ai-deal" element={<AiDealPage />} />
          <Route path="/tariff-sources" element={<TariffSourcesPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route
            path="/counterparty-check"
            element={<CounterpartyCheckPage />}
          />
          <Route path="/contract-diff" element={<ContractDiffPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
