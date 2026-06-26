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

// ── Tariff Types ────────────────────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  aliases: string[];
  country: string | null;
  locType: string | null;
  code: string | null;
}

export interface Tariff {
  id: string;
  transportType: string;
  currency: string;
  ratePerKg: string | null;
  ratePerCbm: string | null;
  ratePerContainer: string | null;
  minCost: string | null;
  validFrom: string;
  validUntil: string;
  sourceType: string;
  notes: string | null;
  isActive: boolean;
  departure: Location;
  destination: Location;
}

export interface TariffUploadRow {
  id: string;
  rowIndex: number;
  departure: string | null;
  destination: string | null;
  departureId: string | null;
  destinationId: string | null;
  departureLocation: Location | null;
  destinationLocation: Location | null;
  transportType: string | null;
  currency: string | null;
  ratePerKg: string | null;
  ratePerCbm: string | null;
  ratePerContainer: string | null;
  minCost: string | null;
  validFrom: string | null;
  validUntil: string | null;
  notes: string | null;
  rowStatus: 'ok' | 'warning' | 'error';
  errorMessage: string | null;
  isEdited: boolean;
}

export interface TariffUploadBatch {
  id: string;
  fileName: string;
  sourceType: string;
  status: string;
  totalRows: number;
  errorCount: number;
  createdAt: string;
  committedAt: string | null;
  rows: TariffUploadRow[];
}

// ── Tariff API Functions ─────────────────────────────────────────────────────

export async function uploadTariffFile(
  file: File,
  sourceType: 'indicative' | 'b24',
): Promise<{ batchId: string; status: string; rowCount: number; errorCount: number; warnings: string[] }> {
  const form = new FormData();
  form.append('file', file);
  form.append('sourceType', sourceType);
  const res = await fetch('/api/worker/tariffs/uploads', {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTariffBatch(batchId: string): Promise<TariffUploadBatch> {
  const res = await fetch(`/api/worker/tariffs/uploads/${batchId}`, {
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateTariffRow(
  batchId: string,
  rowId: string,
  data: Partial<{
    departure: string;
    destination: string;
    transportType: string;
    currency: string;
    ratePerKg: number | null;
    ratePerCbm: number | null;
    ratePerContainer: number | null;
    minCost: number | null;
    validFrom: string;
    validUntil: string;
    notes: string | null;
  }>,
): Promise<TariffUploadRow> {
  const res = await fetch(`/api/worker/tariffs/uploads/${batchId}/rows/${rowId}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function commitTariffBatch(batchId: string): Promise<{ committed: number; skipped: number; errors: string[] }> {
  const res = await fetch(`/api/worker/tariffs/uploads/${batchId}/commit`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listTariffs(params: {
  departure?: string;
  destination?: string;
  transportType?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: Tariff[]; total: number; page: number; limit: number; pages: number }> {
  const q = new URLSearchParams();
  if (params.departure) q.set('departure', params.departure);
  if (params.destination) q.set('destination', params.destination);
  if (params.transportType) q.set('transportType', params.transportType);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const res = await fetch(`/api/worker/tariffs?${q}`, {
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listLocations(search?: string): Promise<Location[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await fetch(`/api/worker/tariffs/locations${q}`, {
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Tariff sources (raw price sheets for AI pricing) ──────────────────────────

export interface TariffSource {
  id: string;
  name: string;
  office: string;
  category: string;
  transportTypes: string[];
  fileName: string;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  uploadedBy: string;
  createdAt: string;
}

export async function uploadTariffSource(
  file: File,
  meta: {
    name: string;
    office: string;
    category: string;
    transportTypes: string[];
    validFrom?: string;
    validUntil?: string;
  },
): Promise<TariffSource> {
  const form = new FormData();
  form.append('file', file);
  form.append('name', meta.name);
  form.append('office', meta.office);
  form.append('category', meta.category);
  form.append('transportTypes', meta.transportTypes.join(','));
  if (meta.validFrom) form.append('validFrom', meta.validFrom);
  if (meta.validUntil) form.append('validUntil', meta.validUntil);
  const res = await fetch('/api/worker/tariffs/sources', {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function listTariffSources(): Promise<TariffSource[]> {
  return req<TariffSource[]>('/worker/tariffs/sources');
}

export function setTariffSourceActive(id: string, isActive: boolean): Promise<TariffSource> {
  return req<TariffSource>(`/worker/tariffs/sources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function deleteTariffSource(id: string): Promise<TariffSource> {
  return req<TariffSource>(`/worker/tariffs/sources/${id}`, { method: 'DELETE' });
}

// ── Legacy API calls (orders) ─────────────────────────────────────────────────

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
