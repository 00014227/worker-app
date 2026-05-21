import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ContractorsPage from './pages/ContractorsPage';
import RateRequestsPage from './pages/RateRequestsPage';
import NewRateRequestPage from './pages/NewRateRequestPage';
import RateRequestDetailPage from './pages/RateRequestDetailPage';
import PublicRatePage from './pages/PublicRatePage';
import ShipmentsPage from './pages/ShipmentsPage';
import NewShipmentPage from './pages/NewShipmentPage';
import ShipmentDetailPage from './pages/ShipmentDetailPage';
import AiDealPage from './pages/AiDealPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/rate/:token" element={<PublicRatePage />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/shipments" replace />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
          <Route path="/shipments/new" element={<NewShipmentPage />} />
          <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
          <Route path="/rate-requests" element={<RateRequestsPage />} />
          <Route path="/rate-requests/new" element={<NewRateRequestPage />} />
          <Route path="/rate-requests/:id" element={<RateRequestDetailPage />} />
          <Route path="/contractors" element={<ContractorsPage />} />
          <Route path="/ai-deal" element={<AiDealPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
