import { authHeaders } from "./auth";

const BASE = "/api";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...opts?.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // NestJS отдаёт message массивом при ошибках валидации DTO и объектом в
    // отдельных случаях — без нормализации в UI прилетало «[object Object]».
    const raw = body?.message ?? body?.error;
    const message = Array.isArray(raw)
      ? raw.join("; ")
      : typeof raw === "string"
        ? raw
        : `Ошибка ${res.status}`;
    throw new Error(message);
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
  activeOnly?: "true";
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
  rowStatus: "ok" | "warning" | "error";
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
  sourceType: "indicative" | "b24",
): Promise<{
  batchId: string;
  status: string;
  rowCount: number;
  errorCount: number;
  warnings: string[];
}> {
  const form = new FormData();
  form.append("file", file);
  form.append("sourceType", sourceType);
  const res = await fetch("/api/worker/tariffs/uploads", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTariffBatch(
  batchId: string,
): Promise<TariffUploadBatch> {
  const res = await fetch(`/api/worker/tariffs/uploads/${batchId}`, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
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
  const res = await fetch(
    `/api/worker/tariffs/uploads/${batchId}/rows/${rowId}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function commitTariffBatch(
  batchId: string,
): Promise<{ committed: number; skipped: number; errors: string[] }> {
  const res = await fetch(`/api/worker/tariffs/uploads/${batchId}/commit`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
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
}): Promise<{
  items: Tariff[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> {
  const q = new URLSearchParams();
  if (params.departure) q.set("departure", params.departure);
  if (params.destination) q.set("destination", params.destination);
  if (params.transportType) q.set("transportType", params.transportType);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  const res = await fetch(`/api/worker/tariffs?${q}`, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listLocations(search?: string): Promise<Location[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`/api/worker/tariffs/locations${q}`, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
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
  form.append("file", file);
  form.append("name", meta.name);
  form.append("office", meta.office);
  form.append("category", meta.category);
  form.append("transportTypes", meta.transportTypes.join(","));
  if (meta.validFrom) form.append("validFrom", meta.validFrom);
  if (meta.validUntil) form.append("validUntil", meta.validUntil);
  const res = await fetch("/api/worker/tariffs/sources", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function listTariffSources(): Promise<TariffSource[]> {
  return req<TariffSource[]>("/worker/tariffs/sources");
}

export function setTariffSourceActive(
  id: string,
  isActive: boolean,
): Promise<TariffSource> {
  return req<TariffSource>(`/worker/tariffs/sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function deleteTariffSource(id: string): Promise<TariffSource> {
  return req<TariffSource>(`/worker/tariffs/sources/${id}`, {
    method: "DELETE",
  });
}

// ── Legacy API calls (orders) ─────────────────────────────────────────────────

export const workerApi = {
  orders: {
    list(q: OrderQuery = {}): Promise<OrderListResponse> {
      const params = new URLSearchParams();
      Object.entries(q).forEach(([k, v]) => {
        if (v !== undefined && v !== "") params.set(k, String(v));
      });
      const qs = params.toString();
      return req<OrderListResponse>(`/worker/orders${qs ? `?${qs}` : ""}`);
    },
    get(id: string): Promise<OrderRow> {
      return req<OrderRow>(`/worker/orders/${id}`);
    },
    stats(): Promise<OrderStats> {
      return req<OrderStats>("/worker/orders/stats");
    },
    map(): Promise<MapOrderRow[]> {
      return req<MapOrderRow[]>("/worker/orders/map");
    },
  },
};

// ── Клиенты: рассылка отчёта по перевозкам ────────────────────────────────────

export interface CustomerRow {
  id: string;
  name: string;
  inn: string | null;
  reportEmails: string | null;
  reportsEnabled: boolean;
  activeOrders: number;
}

export const customersApi = {
  list(search?: string): Promise<CustomerRow[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    return req<CustomerRow[]>(`/worker/customers${q}`);
  },
  updateReports(
    id: string,
    patch: { reportEmails?: string; reportsEnabled?: boolean },
  ) {
    return req<
      Pick<CustomerRow, "id" | "name" | "reportEmails" | "reportsEnabled">
    >(`/worker/customers/${id}/reports`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};

// ── Contractor tenders (выбор подрядчика) ─────────────────────────────────────

export type TenderMode = "auto" | "rail" | "air" | "sea";
export const TENDER_MODE_LABELS: Record<TenderMode, string> = {
  auto: "Авто",
  rail: "Ж/Д",
  air: "Авиа",
  sea: "Море",
};

export type TenderStatus =
  | "draft"
  | "sent"
  | "collecting"
  /** Победителю предложили перевозку — ждём подтверждения до дедлайна. */
  | "award_pending"
  | "decided"
  | "cancelled";

/** Ход подтверждения после выбора подрядчика. */
export type AwardStatus = "pending" | "confirmed" | "refused" | "expired";
export const AWARD_STATUS_LABELS: Record<AwardStatus, string> = {
  pending: "ждём подтверждения",
  confirmed: "подтвердил",
  refused: "отказался",
  expired: "не ответил",
};

/** Причина отказа, распознанная из свободного текста. */
export type DeclineReason =
  | "no_vehicle"
  | "route_not_served"
  | "date_not_suitable"
  | "price_too_low"
  | "other";
export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  no_vehicle: "нет машины",
  route_not_served: "не возят это направление",
  date_not_suitable: "не подходит дата",
  price_too_low: "цена не интересна",
  other: "другое",
};
export type DeliveryStatus = "pending" | "sent" | "error";

export type ContactChannel = "telegram" | "email" | "both";
export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  telegram: "Telegram",
  email: "Почта",
  both: "Оба",
};

export type ContactLanguage = "RU" | "EN" | "UZ";
export const CONTACT_LANGUAGE_LABELS: Record<ContactLanguage, string> = {
  RU: "Русский",
  EN: "English",
  UZ: "Oʻzbekcha",
};

export interface SupplierRow {
  id: string;
  name: string;
  country: string | null;
  email: string | null;
  phone: string | null;
  contactChannel: ContactChannel;
  preferredLanguage: ContactLanguage;
  telegramUsername: string | null;
  telegramBound: boolean;
  telegramAccountId: string | null;
  /**
   * Подрядчик найден в Telegram по телефону и добавлен в контакты. Именно это,
   * а не наличие @username, означает «писать можно»: у половины найденных
   * публичного username нет, но связь работает по числовому ID.
   */
  telegramResolved?: boolean;
  /** Страны, которые возит подрядчик — основа автоподбора. Пусто = не задано. */
  directions: string[];
  /** Виды транспорта (auto|rail|air|sea). Пусто = не задано. */
  transportModes: string[];
  avgResponseTimeSec: number | null;
  responseRate: number | null;
  lastReplyAt: string | null;
  /** Рейтинг надёжности; null у новых подрядчиков без истории. */
  scorecard: SupplierScorecard | null;
}

/** Итог поиска подрядчиков в Telegram по телефонам. */
export interface PhoneResolveResponse {
  summary: {
    total: number;
    resolved: number;
    withUsername: number;
    notFound: number;
    idMismatch: number;
    /** Тот же Telegram уже привязан к другой карточке подрядчика. */
    duplicate: number;
    errors: number;
  };
  /** Telegram остановил прогон лимитом — причина и сколько ждать. */
  flood?: string | null;
  results: Array<{
    supplierId: string;
    name: string;
    phone: string;
    status: "resolved" | "id_mismatch" | "duplicate" | "not_found" | "error";
    username?: string | null;
    message?: string;
    note?: string;
  }>;
}

export interface CreateSupplierInput {
  name: string;
  contactChannel?: ContactChannel;
  preferredLanguage?: ContactLanguage;
  directions?: string[];
  transportModes?: string[];
  telegramUsername?: string;
  telegramUserId?: string;
  country?: string;
  phone?: string;
  email?: string;
  inn?: string;
  code?: string;
}

export interface TenderInviteRow {
  id: string;
  supplierId: string;
  telegramAccountId: string | null;
  channel: string;
  sentAt: string | null;
  deliveryStatus: DeliveryStatus;
  errorMessage: string | null;
  reminderCount: number;
  supplier: { id: string; name: string; telegramUsername: string | null };
  telegramAccount: { id: string; label: string; phone: string } | null;
}

export type PriceBasis = "with_vat" | "without_vat" | "cash" | "other";

export const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  with_vat: "с НДС",
  without_vat: "без НДС",
  cash: "наличными",
  other: "иное",
};

/** Один ценовой вариант из ответа: «1600 с НДС», «1450 налом». */
export interface QuoteOption {
  amount: number;
  currency: string | null;
  basis: PriceBasis | null;
  label: string | null;
}

export interface TenderReplyRow {
  id: string;
  supplierId: string;
  rawText: string;
  receivedAt: string;
  accepted: boolean | null;
  amount: string | null;
  currency: string | null;
  /** База основной цены — цены на разной базе напрямую несравнимы. */
  priceBasis: PriceBasis | null;
  /** Все названные варианты. Больше одного = неоднозначность, решает логист. */
  priceOptions: QuoteOption[] | null;
  transitDays: number | null;
  conditions: string | null;
  aiConfidence: string | null;
  rank: number | null;
  isSelected: boolean;
  /** Ставка пришла после дедлайна подачи. */
  isLate: boolean;
  /** Пусто = подрядчику ещё не предлагали перевозку. */
  awardStatus: AwardStatus | null;
  declineReason: DeclineReason | null;
  /** Непусто = мы дозапросили недостающее (срок/цену) и ждём ответа. */
  clarifyAskedAt: string | null;
  clarifyCount: number;
  supplier: { id: string; name: string };
}

/** Одна присланная ставка — из них складывается динамика цены по подрядчику. */
export interface TenderBidRow {
  id: string;
  supplierId: string;
  amount: string | null;
  currency: string | null;
  receivedAt: string;
}

export interface TenderDetail {
  id: string;
  orderId: string | null;
  origin: string;
  originIndex: string | null;
  originCountry: string | null;
  destination: string;
  destinationIndex: string | null;
  destinationCountry: string | null;
  mode: TenderMode | null;
  cargo: string;
  cargoType: string | null;
  hazardClass: string | null;
  temperatureRegime: string | null;
  vehicleCount: number | null;
  vehicleType: string | null;
  hsCodes: string | null;
  loadingMethod: string | null;
  weightKg: string | null;
  loadingDate: string | null;
  exportCustoms: string | null;
  importCustoms: string | null;
  incoterms: string | null;
  cargoValue: string | null;
  bidDeadline: string | null;
  conditions: string | null;
  comment: string | null;
  currency: string | null;
  status: TenderStatus;
  recommendedSupplierId: string | null;
  /** До какого момента ждём подтверждения от выбранного подрядчика. */
  awardDeadline: string | null;
  /** Непусто = раунд улучшения уже проводился (он один). */
  improvementRequestedAt: string | null;
  improvementDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  invites: TenderInviteRow[];
  replies: TenderReplyRow[];
  /** Все присланные ставки, старые первыми (история торга). */
  bids: TenderBidRow[];
}

/** Откуда взяты цифры бенчмарка — данных по маршрутам мало, поэтому показываем. */
export type BenchmarkLevel = "route" | "country" | "global";

export interface RouteBenchmark {
  level: BenchmarkLevel;
  scope: string;
  currency: string;
  /** Подтверждённые закупки — то, что реально заплатили. */
  purchases: number;
  bids: number;
  /** Медиана закупочных цен (не среднее: один выброс исказил бы среднее). */
  medianPurchase: number | null;
  lastPurchase: number | null;
  lastPurchaseAt: string | null;
  minBid: number | null;
  maxBid: number | null;
  /** false = выборка слишком мала, чтобы на неё опираться. */
  reliable: boolean;
  days: number;
}

/** Рейтинг надёжности подрядчика. */
export interface SupplierScorecard {
  supplierId: string;
  invites: number;
  replies: number;
  /** Выбран и подтвердил — реально взял перевозку. */
  wins: number;
  /** Отказался или промолчал после выбора. */
  breaks: number;
  responseRate: number | null;
  avgResponseMin: number | null;
  /** null = истории недостаточно для честной оценки (не «ноль»). */
  reliability: number | null;
  note: string;
}

/** Сотрудник в админ-разделе. Пароль и его хеш наружу не отдаются. */
export interface EmployeeAdminRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  department: string | null;
  login: string | null;
  /** Есть логин и пароль — сотрудник может войти. */
  hasAccess: boolean;
  isAdmin: boolean;
  /** Доступ к проверке контрагентов. */
  isLawyer: boolean;
  bitrix24Id: number | null;
  /** Слать ли ежедневный Excel по активным перевозкам этого сотрудника. */
  reportsEnabled: boolean;
}

export interface CreateEmployeeInput {
  name: string;
  email?: string;
  phone?: string;
  login?: string;
  password?: string;
  isAdmin?: boolean;
  isLawyer?: boolean;
  bitrix24Id?: number;
  /** Подразделение = офис: от него зависят воронка Битрикса и импорт/экспорт. */
  departmentId?: string;
}

export interface DepartmentRow {
  id: string;
  name: string;
  employees: number;
}

/** Сделка Битрикса на этапе «Расчет ставки» — источник автозаполнения. */
export interface BitrixDealRow {
  id: number;
  title: string;
  /** Сотрудник — ответственный по сделке; такие показываем первыми. */
  mine: boolean;
  origin: string | null;
  destination: string | null;
  createdAt: string | null;
}

/** Поля запроса, заполненные из сделки, + что осталось заполнить руками. */
export interface DealPrefill {
  dealId: number;
  dealTitle: string;
  origin?: string;
  destination?: string;
  originCountry?: string;
  destinationCountry?: string;
  cargo?: string;
  cargoType?: string;
  temperatureRegime?: string;
  weightKg?: number;
  hsCodes?: string;
  vehicleCount?: number;
  incoterms?: string;
  cargoValue?: number;
  currency?: string;
  mode?: TenderMode;
  loadingDate?: string;
  comment?: string;
  unmapped: string[];
}

export interface TenderListRow {
  id: string;
  origin: string;
  destination: string;
  mode: TenderMode | null;
  cargo: string | null;
  weightKg: string | null;
  loadingDate: string | null;
  status: TenderStatus;
  recommendedSupplierId: string | null;
  createdAt: string;
  _count: { invites: number; replies: number };
}

export const CARGO_TYPES = [
  "генеральный",
  "температурный",
  "опасный",
  "акцизный",
] as const;
export type CargoType = (typeof CARGO_TYPES)[number];

/** Кузова. REF — только для температурного груза. */
export const VEHICLE_TYPES = [
  "10 т. тент",
  "10 т. box",
  "10 т. ISO",
  "10 т. тент 90м3",
  "120м3 сцепка",
  "box trailer 90 м3",
  "ISO 90 м3",
  "Мега",
] as const;
export const REF_VEHICLE_TYPE = "REF 90 м3";

export const LOADING_METHODS = ["задняя", "верхняя", "боковая"] as const;

export const INCOTERMS = [
  "EXW",
  "FCA",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
] as const;

export interface CreateTenderInput {
  origin: string;
  originIndex?: string;
  originCountry?: string;
  destination: string;
  destinationIndex?: string;
  destinationCountry?: string;
  loadingDate: string;
  cargoType: CargoType;
  hazardClass?: string;
  temperatureRegime?: string;
  vehicleCount: number;
  vehicleType: string;
  hsCodes: string;
  loadingMethod?: string;
  weightKg: number;
  exportCustoms: string;
  importCustoms: string;
  incoterms: string;
  cargoValue?: number;
  /** ISO instant — форма конвертирует локальное время пикера в ISO. */
  bidDeadline?: string;
  conditions?: string;
  comment?: string;
  mode?: TenderMode;
  cargo: string;
  currency?: string;
  orderId?: string;
  supplierIds?: string[];
  /** Целевая ставка логиста в USD. Число — бэк валидирует как @IsNumber. */
  selfCost?: number;
  /** Сделка Битрикса, из которой заполнен запрос. */
  bitrixDealId?: number;
}

export interface ConversationMessage {
  id: string;
  channel: "telegram" | "email";
  direction: "outgoing" | "incoming";
  text: string;
  subject: string | null;
  status: string | null;
  createdAt: string;
}

export interface TelegramAccountRow {
  id: string;
  label: string;
  phone: string;
  status: "active" | "cooldown" | "blocked" | "loggedout";
  dailySentCount: number;
  lastSentAt: string | null;
  floodWaitUntil: string | null;
  createdAt: string;
}

/** Админ-раздел: сотрудники и их доступ. Требует прав администратора. */
export const employeeApi = {
  list(search?: string): Promise<EmployeeAdminRow[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    return req<EmployeeAdminRow[]>(`/worker/admin/employees${q}`);
  },
  create(input: CreateEmployeeInput): Promise<EmployeeAdminRow> {
    return req<EmployeeAdminRow>("/worker/admin/employees", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  /** Выдать доступ или сбросить пароль. */
  issueCredentials(
    id: string,
    input: {
      login: string;
      password: string;
      isAdmin?: boolean;
  isLawyer?: boolean;
      bitrix24Id?: number;
    },
  ): Promise<EmployeeAdminRow> {
    return req<EmployeeAdminRow>(`/worker/admin/employees/${id}/credentials`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  revokeAccess(id: string): Promise<EmployeeAdminRow> {
    return req<EmployeeAdminRow>(`/worker/admin/employees/${id}/credentials`, {
      method: "DELETE",
    });
  },
  departments(): Promise<DepartmentRow[]> {
    return req<DepartmentRow[]>("/worker/admin/employees/departments");
  },
  update(
    id: string,
    patch: {
      name?: string;
      email?: string;
      phone?: string;
      isAdmin?: boolean;
  isLawyer?: boolean;
      bitrix24Id?: number;
      departmentId?: string;
      reportsEnabled?: boolean;
    },
  ): Promise<EmployeeAdminRow> {
    return req<EmployeeAdminRow>(`/worker/admin/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};

export type NotificationType = "reply" | "award_confirmed" | "award_refused";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  tenderId: string | null;
  supplierId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeed {
  unread: number;
  items: NotificationRow[];
}

/** Колокольчик логиста. Получатель везде берётся из токена. */
export const notificationApi = {
  feed(): Promise<NotificationFeed> {
    return req<NotificationFeed>("/worker/notifications");
  },
  markRead(id: string): Promise<NotificationFeed> {
    return req<NotificationFeed>(`/worker/notifications/${id}/read`, {
      method: "POST",
    });
  },
  markAllRead(): Promise<NotificationFeed> {
    return req<NotificationFeed>("/worker/notifications/read-all", {
      method: "POST",
    });
  },
};

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface CheckSource {
  index: number;
  url: string;
  title: string;
}

/** Какой фрагмент отчёта каким источником подтверждён. */
export interface CheckAnnotation {
  start: number;
  end: number;
  sources: number[];
}

export interface CounterpartyCheck {
  id: string;
  rawQuery: string;
  report: string;
  sources: CheckSource[];
  annotations: CheckAnnotation[] | null;
  searchSuggestions: string | null;
  riskLevel: RiskLevel | null;
  model: string | null;
  createdAt: string;
  /** Отчёт отдан из сохранённых, без нового платного поиска. */
  fromCache?: boolean;
}

export interface CheckHistoryRow {
  id: string;
  rawQuery: string;
  riskLevel: RiskLevel | null;
  createdAt: string;
  employee: { name: string } | null;
}

/** Проверка контрагентов. Доступно юристам и админам. */
export const legalCheckApi = {
  status(): Promise<{ enabled: boolean }> {
    return req<{ enabled: boolean }>("/worker/legal-check/status");
  },
  history(): Promise<CheckHistoryRow[]> {
    return req<CheckHistoryRow[]>("/worker/legal-check");
  },
  byId(id: string): Promise<CounterpartyCheck> {
    return req<CounterpartyCheck>(`/worker/legal-check/${id}`);
  },
  check(query: string, force = false): Promise<CounterpartyCheck> {
    return req<CounterpartyCheck>("/worker/legal-check", {
      method: "POST",
      body: JSON.stringify({ query, force }),
    });
  },
};

export const tenderApi = {
  suppliers: {
    list(search?: string): Promise<SupplierRow[]> {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      return req<SupplierRow[]>(`/worker/suppliers${q}`);
    },
    create(input: CreateSupplierInput): Promise<SupplierRow> {
      return req<SupplierRow>("/worker/suppliers", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    update(
      id: string,
      patch: {
        telegramUsername?: string;
        telegramAccountId?: string;
        contactChannel?: ContactChannel;
        preferredLanguage?: ContactLanguage;
        email?: string;
        /** Ключ к поиску в Telegram, когда нет username. */
        phone?: string;
        directions?: string[];
        transportModes?: string[];
      },
    ) {
      return req(`/worker/suppliers/${id}/telegram`, {
        method: "POST",
        body: JSON.stringify(patch),
      });
    },
    /**
     * Удалить подрядчика (только админ). Удаление физическое: вместе с ним
     * уходят его приглашения, ответы и ставки.
     */
    remove(id: string): Promise<{ name: string }> {
      return req<{ name: string }>(`/worker/suppliers/${id}`, {
        method: "DELETE",
      });
    },
    /**
     * Ищет подрядчиков в Telegram по телефону и сохраняет найденные username.
     * Без этого юзербот не может написать тем, у кого только числовой ID.
     */
    resolveByPhone(supplierIds?: string[]): Promise<PhoneResolveResponse> {
      return req<PhoneResolveResponse>("/worker/suppliers/resolve-by-phone", {
        method: "POST",
        body: JSON.stringify(supplierIds?.length ? { supplierIds } : {}),
      });
    },
    /** Страна по названию города (справочник пунктов) — для автозаполнения формы. */
    resolveCountry(city: string): Promise<{ country: string | null }> {
      return req<{ country: string | null }>(
        `/worker/suppliers/resolve-country?city=${encodeURIComponent(city)}`,
      );
    },
  },
  tenders: {
    list(): Promise<TenderListRow[]> {
      return req<TenderListRow[]>("/worker/tenders");
    },
    get(id: string): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}`);
    },
    create(input: CreateTenderInput): Promise<TenderDetail> {
      return req<TenderDetail>("/worker/tenders", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    send(id: string, supplierIds?: string[]): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}/send`, {
        method: "POST",
        body: JSON.stringify(supplierIds ? { supplierIds } : {}),
      });
    },
    select(id: string, supplierId: string): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}/select`, {
        method: "POST",
        body: JSON.stringify({ supplierId }),
      });
    },
    /** Сделки воронки офиса на этапе «Расчет ставки» (свои первыми). */
    bitrixDeals(): Promise<BitrixDealRow[]> {
      return req<BitrixDealRow[]>("/worker/tenders/bitrix-deals");
    },
    /** Поля запроса из выбранной сделки. */
    dealPrefill(dealId: number): Promise<DealPrefill> {
      return req<DealPrefill>(`/worker/tenders/bitrix-deals/${dealId}/prefill`);
    },
    /** Один раунд торга: тем, кто дороже лидера, уходит «готовы улучшить?». */
    requestImprovement(id: string, deadline?: string): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}/request-improvement`, {
        method: "POST",
        body: JSON.stringify(deadline ? { deadline } : {}),
      });
    },
    /** Переписка с одним подрядчиком — чат логиста с ним. */
    supplierMessages(
      tenderId: string,
      supplierId: string,
    ): Promise<ConversationMessage[]> {
      return req<ConversationMessage[]>(
        `/worker/tenders/${tenderId}/suppliers/${supplierId}/messages`,
      );
    },
    /** Логист пишет подрядчику вручную. Возвращает обновлённую переписку. */
    sendSupplierMessage(
      tenderId: string,
      supplierId: string,
      text: string,
    ): Promise<{ ok: boolean; messages: ConversationMessage[] }> {
      return req(`/worker/tenders/${tenderId}/suppliers/${supplierId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    },
    /** Сколько обычно стоит этот маршрут (медиана закупок + диапазон ставок). */
    benchmark(p: {
      origin?: string | null;
      destination?: string | null;
      originCountry?: string | null;
      destinationCountry?: string | null;
      currency?: string | null;
    }): Promise<RouteBenchmark> {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(p)) if (v) q.set(k, String(v));
      return req<RouteBenchmark>(`/worker/tenders/benchmark?${q}`);
    },
  },
  telegramAccounts: {
    list(): Promise<TelegramAccountRow[]> {
      return req<TelegramAccountRow[]>("/worker/telegram-accounts");
    },
    create(input: {
      label: string;
      phone: string;
      apiId: number;
      apiHash: string;
    }) {
      return req<TelegramAccountRow>("/worker/telegram-accounts", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    sendCode(id: string): Promise<{ ok: boolean }> {
      return req(`/worker/telegram-accounts/${id}/send-code`, {
        method: "POST",
      });
    },
    verify(id: string, code: string): Promise<{ ok: boolean }> {
      return req(`/worker/telegram-accounts/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
    },
  },
};
