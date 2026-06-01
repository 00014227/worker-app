import { authHeaders } from './auth';

const BASE = '/api';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface OrderRow {
  id: string;
  number: string;
  postingDate: string | null;
  status: string | null;
  isClosed: boolean;
  customer: { id: string; name: string } | null;
  payer: { id: string; name: string } | null;
  departure: string | null;
  destination: string | null;
  departureDatePlan: string | null;
  departureDateActual: string | null;
  arrivalDatePlan: string | null;
  arrivalDateActual: string | null;
  declaredWeight: number;
  actualWeight: number;
  vehicleNumbers: string | null;
  vehicleCount: number;
  responsible: { id: string; name: string } | null;
  keyAccountManager: { id: string; name: string } | null;
  transportationType: string | null;
  department: string | null;
  clientOrderNumber: string | null;
  waybillNumber: string | null;
  currentLocation: string | null;
  tracingComment: string | null;
  comment: string | null;
}

export interface OrderListResponse {
  data: OrderRow[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface OrderStats {
  total: number;
  thisMonth: number;
  thisWeek: number;
  byType: { name: string; count: number }[];
}

export interface MapOrderRow {
  id: string;
  number: string;
  status: string | null;
  departure: string | null;
  destination: string | null;
  currentLocation: string | null;
  payer: { id: string; name: string } | null;
  transportationType: string | null;
  lat: number | null;
  lng: number | null;
}

export interface OrderQuery {
  search?: string;
  status?: string;
  transportType?: string;
  responsibleId?: string;
  dateFrom?: string;
  dateTo?: string;
  activeOnly?: 'true';
  page?: number;
  limit?: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const workerApi = {
  orders: {
    list(q: OrderQuery = {}): Promise<OrderListResponse> {
      const params = new URLSearchParams();
      Object.entries(q).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
      });
      const qs = params.toString();
      return req<OrderListResponse>(`/worker/orders${qs ? `?${qs}` : ''}`);
    },
    get(id: string): Promise<OrderRow> {
      return req<OrderRow>(`/worker/orders/${id}`);
    },
    stats(): Promise<OrderStats> {
      return req<OrderStats>('/worker/orders/stats');
    },
    map(): Promise<MapOrderRow[]> {
      return req<MapOrderRow[]>('/worker/orders/map');
    },
  },
};
