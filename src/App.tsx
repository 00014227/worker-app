import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ContractorsPage from './pages/ContractorsPage';
import RateRequestsPage from './pages/RateRequestsPage';
import NewRateRequestPage from './pages/NewRateRequestPage';
import RateRequestDetailPage from './pages/RateRequestDetailPage';
import TelegramAccountsPage from './pages/TelegramAccountsPage';
import DashboardPage from './pages/DashboardPage';
import ShipmentsPage from './pages/ShipmentsPage';
import NewShipmentPage from './pages/NewShipmentPage';
import ShipmentDetailPage from './pages/ShipmentDetailPage';
import EditShipmentPage from './pages/EditShipmentPage';
import AiDealPage from './pages/AiDealPage';
import MapPage from './pages/MapPage';
import TariffSourcesPage from './pages/TariffSourcesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
          <Route path="/shipments/new" element={<NewShipmentPage />} />
          <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
          <Route path="/shipments/:id/edit" element={<EditShipmentPage />} />
          <Route path="/rate-requests" element={<RateRequestsPage />} />
          <Route path="/rate-requests/new" element={<NewRateRequestPage />} />
          <Route path="/rate-requests/:id" element={<RateRequestDetailPage />} />
          <Route path="/contractors" element={<ContractorsPage />} />
          <Route path="/telegram-accounts" element={<TelegramAccountsPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/ai-deal" element={<AiDealPage />} />
          <Route path="/tariff-sources" element={<TariffSourcesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
