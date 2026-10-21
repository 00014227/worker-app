import { authHeaders, handleUnauthorized } from './auth';

const BASE = '/api';

/** Тот же запрос, что и у кабинета. Открыт для Mini App, чтобы не плодить обёртки. */
export async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  return req<T>(path, opts);
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...opts?.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      // Что делать — решает auth.ts: в кабинете это переход на вход, в Mini App
      // переход на страницу входа выглядел бы поломкой.
      handleUnauthorized();
    }
    // NestJS отдаёт message массивом при ошибках валидации DTO и объектом в
    // отдельных случаях — без нормализации в UI прилетало «[object Object]».
    // Глобальный фильтр бэкенда кладёт ответ исключения целиком в message:
    // { message: { message: 'текст', error, statusCode } } — достаём текст оттуда.
    const outer = body?.message ?? body?.error;
    const raw =
      outer && typeof outer === 'object' && !Array.isArray(outer)
        ? outer.message
        : outer;
    const message = Array.isArray(raw)
      ? raw.join('; ')
      : typeof raw === 'string'
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
): Promise<{
  batchId: string;
  status: string;
  rowCount: number;
  errorCount: number;
  warnings: string[];
}> {
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

export async function getTariffBatch(
  batchId: string,
): Promise<TariffUploadBatch> {
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
  const res = await fetch(
    `/api/worker/tariffs/uploads/${batchId}/rows/${rowId}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
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
}): Promise<{
  items: Tariff[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> {
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

export function setTariffSourceActive(
  id: string,
  isActive: boolean,
): Promise<TariffSource> {
  return req<TariffSource>(`/worker/tariffs/sources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function deleteTariffSource(id: string): Promise<TariffSource> {
  return req<TariffSource>(`/worker/tariffs/sources/${id}`, {
    method: 'DELETE',
  });
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
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return req<CustomerRow[]>(`/worker/customers${q}`);
  },
  updateReports(
    id: string,
    patch: { reportEmails?: string; reportsEnabled?: boolean },
  ) {
    return req<
      Pick<CustomerRow, 'id' | 'name' | 'reportEmails' | 'reportsEnabled'>
    >(`/worker/customers/${id}/reports`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
};

// ── Contractor tenders (выбор подрядчика) ─────────────────────────────────────

export type TenderMode = 'auto' | 'rail' | 'air' | 'sea';
export const TENDER_MODE_LABELS: Record<TenderMode, string> = {
  auto: 'Авто',
  rail: 'Ж/Д',
  air: 'Авиа',
  sea: 'Море',
};

export type TenderStatus =
  | 'draft'
  | 'sent'
  | 'collecting'
  /** Победителю предложили перевозку — ждём подтверждения до дедлайна. */
  | 'award_pending'
  | 'decided'
  /** Запрос закрыт — вручную или автоматически как брошенный. */
  | 'closed'
  | 'cancelled';

/** Ход подтверждения после выбора подрядчика. */
export type AwardStatus = 'pending' | 'confirmed' | 'refused' | 'expired';
export const AWARD_STATUS_LABELS: Record<AwardStatus, string> = {
  pending: 'ждём подтверждения',
  confirmed: 'подтвердил',
  refused: 'отказался',
  expired: 'не ответил',
};

/** Причина отказа, распознанная из свободного текста. */
export type DeclineReason =
  | 'no_vehicle'
  | 'route_not_served'
  | 'date_not_suitable'
  | 'price_too_low'
  | 'other';
export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  no_vehicle: 'нет машины',
  route_not_served: 'не возят это направление',
  date_not_suitable: 'не подходит дата',
  price_too_low: 'цена не интересна',
  other: 'другое',
};
export type DeliveryStatus = 'pending' | 'sent' | 'error';

export type ContactChannel = 'telegram' | 'email' | 'both';
export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  telegram: 'Telegram',
  email: 'Почта',
  both: 'Оба',
};

export type ContactLanguage = 'RU' | 'EN' | 'UZ';
export const CONTACT_LANGUAGE_LABELS: Record<ContactLanguage, string> = {
  RU: 'Русский',
  EN: 'English',
  UZ: 'Oʻzbekcha',
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
  /**
   * Причина последнего неудачного поиска по телефону: not_found (скрыт
   * приватностью) | id_mismatch (номер уже принадлежит другому Telegram-ID) |
   * duplicate (этот Telegram занят другой карточкой) | error. Пусто, если
   * попытки не было или последняя удалась.
   */
  telegramResolveStatus?: string | null;
  telegramResolveNote?: string | null;
  /** Страны, которые возит подрядчик — основа автоподбора. Пусто = не задано. */
  directions: string[];
  /** Виды транспорта (auto|rail|air|sea). Пусто = не задано. */
  transportModes: string[];
  avgResponseTimeSec: number | null;
  responseRate: number | null;
  lastReplyAt: string | null;
  /** Рейтинг надёжности; null у новых подрядчиков без истории. */
  scorecard: SupplierScorecard | null;
  /**
   * Типы кузова в парке подрядчика: тент, box, ISO, Мега, REF. Необязательное
   * намеренно: пока в прод не уехал бэкенд с этим полем, ответ приходит без
   * него — читать только как `vehicleTypes ?? []`, иначе `.map` уронит страницу.
   * Пусто = не задано; фильтр по кузову таких подрядчиков не скрывает.
   */
  vehicleTypes?: string[];
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
    status: 'resolved' | 'id_mismatch' | 'duplicate' | 'not_found' | 'error';
    username?: string | null;
    message?: string;
    note?: string;
  }>;
}

/** Похожий подрядчик, найденный при проверке на дубли — и по какому полю. */
export interface DuplicateSupplierMatch {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  telegramUsername: string | null;
  matchedOn: ('name' | 'phone' | 'email' | 'telegramUsername')[];
}

export interface CreateSupplierInput {
  name: string;
  contactChannel?: ContactChannel;
  preferredLanguage?: ContactLanguage;
  directions?: string[];
  transportModes?: string[];
  vehicleTypes?: string[];
  telegramUsername?: string;
  telegramUserId?: string;
  country?: string;
  phone?: string;
  email?: string;
  inn?: string;
  code?: string;
  /** Похожие подрядчики уже показаны логисту, и он подтвердил — сохранить всё равно. */
  force?: boolean;
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

export type PriceBasis = 'with_vat' | 'without_vat' | 'cash' | 'other';

export const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  with_vat: 'с НДС',
  without_vat: 'без НДС',
  cash: 'наличными',
  other: 'иное',
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
  /** Непусто = запрос закрыт: напоминания по нему больше не уходят. */
  closedAt: string | null;
  /** Рассылка запущена и идёт в фоне — прогресс приходит по сокету. */
  sending?: boolean;
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
export type BenchmarkLevel = 'route' | 'country' | 'global';

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
  /** Личный вебхук внесён — сделки уходят от имени сотрудника. */
  bitrixWebhookConnected: boolean;
  /** Замаскированный вид: сам ключ наружу не отдаётся. */
  bitrixWebhookMasked: string | null;
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
  'генеральный',
  'температурный',
  'опасный',
  'акцизный',
] as const;
export type CargoType = (typeof CARGO_TYPES)[number];

/** Кузова. REF — только для температурного груза. */
export const VEHICLE_TYPES = [
  '10 т. тент',
  '10 т. box',
  '10 т. ISO',
  'тент 90м3',
  '120м3 сцепка',
  'box trailer 90 м3',
  'ISO 90 м3',
  'Мега',
] as const;
export const REF_VEHICLE_TYPE = 'REF 90 м3';

export const LOADING_METHODS = ['задняя', 'верхняя', 'боковая'] as const;

export const INCOTERMS = [
  'EXW',
  'FCA',
  'FAS',
  'FOB',
  'CFR',
  'CIF',
  'CPT',
  'CIP',
  'DAP',
  'DPU',
  'DDP',
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
  channel: 'telegram' | 'email';
  direction: 'outgoing' | 'incoming';
  text: string;
  subject: string | null;
  status: string | null;
  createdAt: string;
  /** voice | photo | document — пусто у обычного текстового сообщения. */
  mediaKind: 'voice' | 'photo' | 'document' | null;
  mediaName: string | null;
  mediaSize: number | null;
  /** Длительность голосового в секундах — видна до нажатия «слушать». */
  mediaDuration: number | null;
  /** Файл удалён по сроку хранения: сообщение осталось, вложения уже нет. */
  mediaPurged: boolean;
}

/**
 * Вложение переписки. Грузим запросом с токеном и отдаём `blob:`-ссылку:
 * `<img src>` и `<audio src>` заголовок с авторизацией слать не умеют, а
 * открывать фото грузов и накладные наружу без проверки прав нельзя.
 */
export async function fetchMediaUrl(messageId: string): Promise<string> {
  const res = await fetch(`/api/worker/tenders/media/${messageId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Вложение недоступно');
  return URL.createObjectURL(await res.blob());
}

export interface TelegramAccountRow {
  id: string;
  label: string;
  phone: string;
  status: 'active' | 'cooldown' | 'blocked' | 'loggedout';
  dailySentCount: number;
  lastSentAt: string | null;
  floodWaitUntil: string | null;
  createdAt: string;
}

/** Админ-раздел: сотрудники и их доступ. Требует прав администратора. */
export const employeeApi = {
  list(search?: string): Promise<EmployeeAdminRow[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return req<EmployeeAdminRow[]>(`/worker/admin/employees${q}`);
  },
  create(input: CreateEmployeeInput): Promise<EmployeeAdminRow> {
    return req<EmployeeAdminRow>('/worker/admin/employees', {
      method: 'POST',
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
      /** Ссылка целиком; пустая строка снимает её. */
      bitrixWebhookUrl?: string;
    },
  ): Promise<EmployeeAdminRow> {
    return req<EmployeeAdminRow>(`/worker/admin/employees/${id}/credentials`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  revokeAccess(id: string): Promise<EmployeeAdminRow> {
    return req<EmployeeAdminRow>(`/worker/admin/employees/${id}/credentials`, {
      method: 'DELETE',
    });
  },
  departments(): Promise<DepartmentRow[]> {
    return req<DepartmentRow[]>('/worker/admin/employees/departments');
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
      /** Ссылка целиком; пустая строка снимает её. */
      bitrixWebhookUrl?: string;
      departmentId?: string;
      reportsEnabled?: boolean;
    },
  ): Promise<EmployeeAdminRow> {
    return req<EmployeeAdminRow>(`/worker/admin/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
};

export type NotificationType = 'reply' | 'award_confirmed' | 'award_refused';

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
/** От чьего имени уйдёт сделка: личный вебхук сотрудника или общий аккаунт. */
export const aiDealApi = {
  author(): Promise<{ personal: boolean }> {
    return req<{ personal: boolean }>('/ai-deal/author');
  },
};

export const notificationApi = {
  feed(): Promise<NotificationFeed> {
    return req<NotificationFeed>('/worker/notifications');
  },
  markRead(id: string): Promise<NotificationFeed> {
    return req<NotificationFeed>(`/worker/notifications/${id}/read`, {
      method: 'POST',
    });
  },
  markAllRead(): Promise<NotificationFeed> {
    return req<NotificationFeed>('/worker/notifications/read-all', {
      method: 'POST',
    });
  },
  /** Переписку с подрядчиком открыли — гасим всё непрочитанное по ней. */
  markThreadRead(
    tenderId: string,
    supplierId: string,
  ): Promise<NotificationFeed> {
    return req<NotificationFeed>('/worker/notifications/read-thread', {
      method: 'POST',
      body: JSON.stringify({ tenderId, supplierId }),
    });
  },
  /** Сколько непрочитанного по каждому подрядчику запроса: supplierId → число. */
  unreadBySupplier(tenderId: string): Promise<Record<string, number>> {
    return req<Record<string, number>>(
      `/worker/notifications/unread-by-supplier?tenderId=${tenderId}`,
    );
  },
};

// ── Сверка договоров ─────────────────────────────────────────────────────────

/** Чей документ считаем исходным: наш шаблон или просто две версии. */
export type DiffMode = 'ours' | 'neutral';
export type DiffRisk = 'high' | 'medium' | 'low';
export type DiffSide = 'us' | 'counterparty' | 'neutral';
export type DiffAdvice = 'accept' | 'discuss' | 'reject';
export type DiffKind = 'same' | 'modified' | 'added' | 'removed' | 'moved';

/** Кусок пословной разметки внутри изменённого пункта. */
export interface WordPart {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

/** Одна правка: что нашла механика плюс толкование модели. */
export interface DiffItem {
  id: string;
  kind: DiffKind;
  clauseNumber: string | null;
  before: string | null;
  after: string | null;
  parts: WordPart[] | null;
  summary: string | null;
  side: DiffSide | null;
  risk: DiffRisk | null;
  reason: string | null;
  advice: DiffAdvice | null;
  adviceText: string | null;
}

/** Пункт в общем выравнивании — включая совпавшие, для показа текстов рядом. */
export interface DiffClause {
  kind: DiffKind;
  leftNumber: string | null;
  rightNumber: string | null;
  /** Страница подлинника — по ней открывается кнопка «оригинал». */
  leftPage: number | null;
  rightPage: number | null;
  before: string | null;
  after: string | null;
  parts: WordPart[] | null;
}

export interface ContractDiff {
  id: string;
  /** processing — разбор идёт в фоне; done — готово; failed — смотри error. */
  status: 'processing' | 'done' | 'failed';
  /** Что делается сейчас: reading | ocr | aligning | interpreting. */
  stage: string | null;
  progressDone: number | null;
  progressTotal: number | null;
  error: string | null;
  /** Текст получен распознаванием: мелкие расхождения могут быть его ошибками. */
  leftOcr: boolean;
  rightOcr: boolean;
  leftName: string;
  rightName: string;
  mode: DiffMode;
  leftClauseCount: number;
  rightClauseCount: number;
  changeCount: number;
  highRiskCount: number;
  items: DiffItem[];
  clauses: DiffClause[];
  createdAt: string;
}

export interface ContractDiffRow {
  id: string;
  leftName: string;
  rightName: string;
  mode: DiffMode;
  changeCount: number;
  highRiskCount: number;
  createdAt: string;
  status: 'processing' | 'done' | 'failed';
  error: string | null;
  employee: { name: string } | null;
}

export const contractDiffApi = {
  status(): Promise<{ enabled: boolean }> {
    return req<{ enabled: boolean }>('/worker/contract-diff/status');
  },
  history(): Promise<ContractDiffRow[]> {
    return req<ContractDiffRow[]>('/worker/contract-diff');
  },
  byId(id: string): Promise<ContractDiff> {
    return req<ContractDiff>(`/worker/contract-diff/${id}`);
  },
  /**
   * Исходный файл сверки. Грузим запросом с токеном и отдаём blob-ссылку:
   * встроенный просмотр PDF не умеет слать заголовок с авторизацией, а
   * подписанные договоры открывать наружу нельзя.
   */
  async originalUrl(id: string, side: 'left' | 'right'): Promise<string> {
    const res = await fetch(
      `/api/worker/contract-diff/${id}/original/${side}`,
      {
        headers: authHeaders(),
      },
    );
    if (!res.ok) throw new Error('Исходный файл недоступен');
    return URL.createObjectURL(await res.blob());
  },
  /** Два файла одним запросом: порядок задаёт, с чьей стороны будет оценка. */
  async compare(
    left: File,
    right: File,
    mode: DiffMode,
  ): Promise<ContractDiff> {
    const form = new FormData();
    form.append('left', left);
    form.append('right', right);
    form.append('mode', mode);
    const res = await fetch('/api/worker/contract-diff', {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const raw = body?.message ?? body?.error;
      throw new Error(
        Array.isArray(raw)
          ? raw.join('; ')
          : typeof raw === 'string'
            ? raw
            : `Ошибка ${res.status}`,
      );
    }
    return res.json();
  },
};

export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';

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
  /** processing — поиск ещё идёт; отчёт и источники появятся по готовности. */
  status: 'processing' | 'done' | 'failed';
  error: string | null;
  /** Отчёт отдан из сохранённых, без нового платного поиска. */
  fromCache?: boolean;
}

export interface CheckHistoryRow {
  id: string;
  rawQuery: string;
  riskLevel: RiskLevel | null;
  createdAt: string;
  status: 'processing' | 'done' | 'failed';
  error: string | null;
  employee: { name: string } | null;
}

/** Проверка контрагентов. Доступно юристам и админам. */
export const legalCheckApi = {
  status(): Promise<{ enabled: boolean }> {
    return req<{ enabled: boolean }>('/worker/legal-check/status');
  },
  history(): Promise<CheckHistoryRow[]> {
    return req<CheckHistoryRow[]>('/worker/legal-check');
  },
  byId(id: string): Promise<CounterpartyCheck> {
    return req<CounterpartyCheck>(`/worker/legal-check/${id}`);
  },
  check(query: string, force = false): Promise<CounterpartyCheck> {
    return req<CounterpartyCheck>('/worker/legal-check', {
      method: 'POST',
      body: JSON.stringify({ query, force }),
    });
  },
};

// ── Дебиторка ────────────────────────────────────────────────────────────────

/** dry-run — только журнал; test — письма на тестовый ящик; live — клиентам. */
export type DebtMailMode = 'dry-run' | 'test' | 'live';

export type DebtLetterStatus =
  | 'dry_run'
  | 'pending_approval'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'error'
  | 'cancelled';

/** Сумма в одной валюте. Сумы и доллары не складываются — показываем рядом. */
export interface MoneyByCurrency {
  currency: string;
  /** Строкой: деньги из базы приходят точными, без float. */
  amount: string;
}

export interface DebtorRow {
  customerId: string;
  name: string;
  inn: string | null;
  email: string | null;
  /** По самому просроченному акту (с учётом отсрочки); null — просроченных нет. */
  daysOverdue: number | null;
  /** Самый поздний этап, чей день уже наступил по какому-нибудь акту. */
  stage: { stage: number; title: string } | null;
  debt: MoneyByCurrency[];
  overdue: MoneyByCurrency[];
  /** Долг без срока: в 1С нет акта или срока оплаты — письмом не отправляется. */
  undated: MoneyByCurrency[];
  /** Наши юрлица, которым должен клиент; от каждого — своё письмо. */
  organizations: string[];
  lastLetter: {
    stage: number;
    status: DebtLetterStatus;
    createdAt: string;
  } | null;
  /** Действующая отсрочка — новый крайний срок оплаты. */
  deferral: { until: string; reason: DebtDeferralReason } | null;
  /** Стопы: спор по сумме, претензия направлена — автоматических писем нет. */
  stops: DebtStopKind[];
  /** Какое письмо уйдёт следующим и когда (YYYY-MM-DD). */
  nextLetter: { stage: number; title: string; date: string } | null;
}

/** Стоп для писем клиенту. */
export type DebtStopKind = 'dispute' | 'claim';

export const STOP_KIND_LABELS: Record<DebtStopKind, string> = {
  dispute: 'Спор по сумме',
  claim: 'Претензия направлена',
};

export interface DebtorStop {
  id: string;
  kind: DebtStopKind;
  comment: string | null;
  createdAt: string;
  createdBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  active: boolean;
}

/** Почему отложили письма. */
export type DebtDeferralReason = 'payment_order' | 'schedule' | 'other';

export const DEFERRAL_REASON_LABELS: Record<DebtDeferralReason, string> = {
  payment_order: 'Прислал платёжку',
  schedule: 'Согласован график',
  other: 'Другое',
};

export interface DebtorDeferral {
  id: string;
  /** YYYY-MM-DD, включительно. */
  until: string;
  reason: DebtDeferralReason;
  comment: string | null;
  createdAt: string;
  createdBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  active: boolean;
}

export interface DebtorDocument {
  id: string;
  docNumber: string;
  contractNumber: string | null;
  /** YYYY-MM-DD; null — в 1С нет акта или срока, письмом не отправляется. */
  docDate: string | null;
  /** Срок по договору. */
  dueDate: string | null;
  /** Действующий срок: после отсрочки — новый. */
  deadline: string | null;
  amount: string;
  paid: string;
  balance: string;
  currency: string;
  daysOverdue: number | null;
  /** Организация-кредитор (из 1С). */
  organizationName: string | null;
  /** Дней на оплату после акта и откуда: contract — договор, payment_term — справочник. */
  termDays: number | null;
  /** В каких днях срок: банковские и рабочие считаются по рабочим дням. */
  termUnit: 'calendar' | 'working' | 'banking' | null;
  dueDateSource: 'contract' | 'payment_term' | 'none' | null;
  /** Письма, уже ушедшие по этому акту (номера этапов). */
  stagesDone: number[];
}

export interface DebtorLetter {
  id: string;
  stage: number;
  mode: DebtMailMode;
  status: DebtLetterStatus;
  daysOverdue: number;
  toAddr: string;
  ccAddr: string | null;
  /** Куда уйдёт ответ клиента — КАМ. */
  replyToAddr: string | null;
  subject: string;
  html: string;
  createdAt: string;
  sentAt: string | null;
  error: string | null;
  caseClosed: boolean;
}

export interface DebtStage {
  stage: number;
  title: string;
  /** Когда уходит: «T÷2 дней от даты АВР», «просрочка 14 дней»… */
  when: string;
}

/** Праздник — нерабочий день рассылки. */
export interface DebtHoliday {
  /** YYYY-MM-DD. */
  date: string;
  name: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** Почему письмо не ушло. */
export type DebtStopReason = 'no_email' | 'dispute' | 'claim' | 'no_term';

export interface DunningRunResult {
  mode: DebtMailMode;
  created: number;
  /** Отправлено / не ушло (в режиме проверки всегда 0). */
  sent: number;
  failed: number;
  cancelled: number;
  closed: number;
  letters: { customer: string; stage: number; acts: string[]; to: string }[];
  stopped: {
    customer: string;
    reason: DebtStopReason;
    stage?: number;
    acts: string[];
  }[];
}

/**
 * Дебиторка: смотреть и ставить отсрочку — всем; прогонять и ставить стопы —
 * юристам и админам.
 */
export const receivablesApi = {
  list(): Promise<{
    mode: DebtMailMode;
    /** Куда уходят письма в тестовом режиме. */
    testRecipient: string;
    /** Организация и контакт в подписи заполнены; нет — клиентам письма не уходят. */
    lettersReady: boolean;
    stages: DebtStage[];
    /** Ближайший прогон рассылки по расписанию (ISO); null — расписание не запущено. */
    nextRun: string | null;
    rows: DebtorRow[];
  }> {
    return req('/worker/receivables');
  },
  details(customerId: string): Promise<{
    documents: DebtorDocument[];
    letters: DebtorLetter[];
    deferrals: DebtorDeferral[];
    stops: DebtorStop[];
  }> {
    return req(`/worker/receivables/${customerId}`);
  },
  defer(
    customerId: string,
    input: { until: string; reason: DebtDeferralReason; comment?: string },
  ): Promise<{ id: string }> {
    return req(`/worker/receivables/${customerId}/deferrals`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  cancelDeferral(id: string): Promise<{ id: string }> {
    return req(`/worker/receivables/deferrals/${id}/cancel`, {
      method: 'POST',
    });
  },
  run(): Promise<DunningRunResult> {
    return req('/worker/receivables/run', { method: 'POST' });
  },
  stop(
    customerId: string,
    input: { kind: DebtStopKind; comment?: string },
  ): Promise<{ id: string }> {
    return req(`/worker/receivables/${customerId}/stops`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  cancelStop(id: string): Promise<{ id: string }> {
    return req(`/worker/receivables/stops/${id}/cancel`, { method: 'POST' });
  },
  holidays(): Promise<DebtHoliday[]> {
    return req('/worker/receivables/holidays');
  },
  addHoliday(input: { date: string; name?: string }): Promise<DebtHoliday> {
    return req('/worker/receivables/holidays', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  removeHoliday(date: string): Promise<{ date: string }> {
    return req(`/worker/receivables/holidays/${date}`, { method: 'DELETE' });
  },
};

export const tenderApi = {
  suppliers: {
    list(search?: string): Promise<SupplierRow[]> {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return req<SupplierRow[]>(`/worker/suppliers${q}`);
    },
    create(
      input: CreateSupplierInput,
    ): Promise<
      | { status: 'created'; supplier: SupplierRow }
      | { status: 'duplicates'; duplicates: DuplicateSupplierMatch[] }
    > {
      return req('/worker/suppliers', {
        method: 'POST',
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
        vehicleTypes?: string[];
        /** Похожие подрядчики уже показаны логисту, и он подтвердил — сохранить всё равно. */
        force?: boolean;
      },
    ): Promise<
      | { status: 'updated'; supplier: SupplierRow }
      | { status: 'duplicates'; duplicates: DuplicateSupplierMatch[] }
    > {
      return req(`/worker/suppliers/${id}/telegram`, {
        method: 'POST',
        body: JSON.stringify(patch),
      });
    },
    /**
     * Удалить подрядчика (только админ). Удаление физическое: вместе с ним
     * уходят его приглашения, ответы и ставки.
     */
    remove(id: string): Promise<{ name: string }> {
      return req<{ name: string }>(`/worker/suppliers/${id}`, {
        method: 'DELETE',
      });
    },
    /**
     * Ищет подрядчиков в Telegram по телефону и сохраняет найденные username.
     * Без этого юзербот не может написать тем, у кого только числовой ID.
     */
    resolveByPhone(supplierIds?: string[]): Promise<PhoneResolveResponse> {
      return req<PhoneResolveResponse>('/worker/suppliers/resolve-by-phone', {
        method: 'POST',
        body: JSON.stringify(supplierIds?.length ? { supplierIds } : {}),
      });
    },
    /**
     * Логист вручную подтверждает: номер принадлежит этому подрядчику, даже
     * если сохранённый Telegram-ID разошёлся с тем, что сейчас отдаёт Telegram
     * по телефону.
     */
    confirmTelegram(supplierId: string): Promise<{
      result: PhoneResolveResponse['results'][number];
      supplier: SupplierRow;
    }> {
      return req(`/worker/suppliers/${supplierId}/confirm-telegram`, {
        method: 'POST',
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
      return req<TenderListRow[]>('/worker/tenders');
    },
    get(id: string): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}`);
    },
    create(input: CreateTenderInput): Promise<TenderDetail> {
      return req<TenderDetail>('/worker/tenders', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    send(id: string, supplierIds?: string[]): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}/send`, {
        method: 'POST',
        body: JSON.stringify(supplierIds ? { supplierIds } : {}),
      });
    },
    /** Закрыть запрос: напоминания по нему прекращаются. */
    close(id: string): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}/close`, {
        method: 'POST',
      });
    },
    select(id: string, supplierId: string): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}/select`, {
        method: 'POST',
        body: JSON.stringify({ supplierId }),
      });
    },
    /** Сделки воронки офиса на этапе «Расчет ставки» (свои первыми). */
    bitrixDeals(): Promise<BitrixDealRow[]> {
      return req<BitrixDealRow[]>('/worker/tenders/bitrix-deals');
    },
    /** Поля запроса из выбранной сделки. */
    dealPrefill(dealId: number): Promise<DealPrefill> {
      return req<DealPrefill>(`/worker/tenders/bitrix-deals/${dealId}/prefill`);
    },
    /** Один раунд торга: тем, кто дороже лидера, уходит «готовы улучшить?». */
    requestImprovement(id: string, deadline?: string): Promise<TenderDetail> {
      return req<TenderDetail>(`/worker/tenders/${id}/request-improvement`, {
        method: 'POST',
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
    /** Логист отправляет подрядчику файл или фото; подпись необязательна. */
    async sendSupplierFile(
      tenderId: string,
      supplierId: string,
      file: File,
      caption?: string,
    ): Promise<{ ok: boolean; messages: ConversationMessage[] }> {
      const form = new FormData();
      form.append('file', file);
      if (caption?.trim()) form.append('caption', caption.trim());
      const res = await fetch(
        `/api/worker/tenders/${tenderId}/suppliers/${supplierId}/file`,
        { method: 'POST', headers: authHeaders(), body: form },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const raw = body?.message ?? body?.error;
        throw new Error(
          Array.isArray(raw)
            ? raw.join('; ')
            : typeof raw === 'string'
              ? raw
              : 'Не удалось отправить файл',
        );
      }
      return res.json();
    },
    /** Логист пишет подрядчику вручную. Возвращает обновлённую переписку. */
    sendSupplierMessage(
      tenderId: string,
      supplierId: string,
      text: string,
    ): Promise<{ ok: boolean; messages: ConversationMessage[] }> {
      return req(
        `/worker/tenders/${tenderId}/suppliers/${supplierId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ text }),
        },
      );
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
      return req<TelegramAccountRow[]>('/worker/telegram-accounts');
    },
    create(input: {
      label: string;
      phone: string;
      apiId: number;
      apiHash: string;
    }) {
      return req<TelegramAccountRow>('/worker/telegram-accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    sendCode(id: string): Promise<{ ok: boolean }> {
      return req(`/worker/telegram-accounts/${id}/send-code`, {
        method: 'POST',
      });
    },
    verify(id: string, code: string): Promise<{ ok: boolean }> {
      return req(`/worker/telegram-accounts/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },
  },
};

// ── Служебные записки ──────────────────────────────────────────────────────

/** Все известные типы. Прежние остаются: их записки надо открывать. */
export type MemoType =
  'absence' | 'extra_expenses' | 'payment' | 'purchase' | 'trip' | 'other';
export type MemoStatus =
  | 'draft'
  | 'pending_approval'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'cancelled';
export type MemoDecisionKind = 'approve' | 'reject' | 'return';
export type MemoTaskStatus =
  | 'waiting'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled'
  | 'skipped';

export interface MemoFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select';
  required: boolean;
  hint?: string;
  maxLength?: number;
  /** Закрытый список для 'select' — рисуется выпадающим списком. */
  options?: { value: string; label: string }[];
  /** Поле обязательно только при этих значениях другого поля. */
  requiredWhen?: { key: string; equals: string[] };
}

export interface MemoMeta {
  /** Все известные типы — по ним карточка находит описания полей. */
  types: {
    type: MemoType;
    fields: MemoFieldDef[];
    amountRequired: boolean;
    /** Где тип заполняется. `miniapp` кабинет предлагать не должен. */
    createdIn: 'cabinet' | 'miniapp' | 'both';
  }[];
  /** Что можно создать сейчас. Остальное — только читать. */
  creatableTypes: MemoType[];
  /**
   * Что может создать кабинет. Уже отфильтровано сервером по `createdIn`:
   * обоснование доп. расходов заполняется только в Telegram, потому что
   * кабинет не умеет рисовать таблицу расходов.
   */
  cabinetCreatableTypes: MemoType[];
  statuses: MemoStatus[];
  currencies: string[];
  departments: { id: string; name: string }[];
  can: { manage: boolean; decide: boolean };
  myRoleIds: string[];
  myTaskCount: number;
  /** Привязан ли Telegram. Без привязки согласующий не получит уведомлений. */
  telegramLinked: boolean;
}

export interface MemoRow {
  id: string;
  number: string | null;
  memoType: MemoType;
  title: string;
  status: MemoStatus;
  /** Деньги строкой: из базы приходят точными, без float. */
  amount: string | null;
  currency: string | null;
  createdAt: string;
  submittedAt: string | null;
  authorName: string;
  departmentName: string | null;
  currentStepNo: number | null;
  currentRoleName: string | null;
  dueAt: string | null;
}

export interface MemoListResponse {
  data: MemoRow[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface MemoRouteStepView {
  taskId: string;
  stepNo: number;
  attempt: number;
  status: MemoTaskStatus;
  isMandatory: boolean;
  roleName: string;
  activatedAt: string | null;
  dueAt: string | null;
  decidedAt: string | null;
  decision: {
    decision: MemoDecisionKind;
    comment: string | null;
    source: 'web' | 'telegram';
    at: string;
    byName: string;
  } | null;
}

export interface MemoAttachmentView {
  id: string;
  name: string;
  size: number;
  mime: string;
  createdAt: string;
}

export interface MemoEventView {
  kind: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  actorEmployeeId: string | null;
}

/** Строка таблицы расходов. Деньги строками — точность не теряется. */
export interface MemoExpenseLineView {
  expenseType: string;
  /** Кому платим — как ввёл автор. */
  counterpartyName: string | null;
  /** Контрагент 1С, если имя выбрали из подсказки. */
  counterpartyId: string | null;
  planned: string;
  actual: string;
  /** Факт минус план. Положительное — перерасход. */
  diff: string;
}

/** Табличная часть обоснования доп. расходов. */
export interface MemoExtraExpenseView {
  orderNumber: string;
  /** Есть, только если по номеру нашлась ровно одна перевозка. */
  orderId: string | null;
  currency: string | null;
  lines: MemoExpenseLineView[];
  plannedTotal: string;
  actualTotal: string;
  /** Итог факта минус итог плана. Отрицательное — сэкономили. */
  expenseOverrun: string;
  incomePlanned: string;
  incomeActual: string;
  incomeDiff: string;
  rebilled: string;
  culprit: string | null;
}

export interface MemoCard {
  id: string;
  number: string | null;
  memoType: MemoType;
  title: string;
  justification: string;
  amount: string | null;
  currency: string | null;
  payload: Record<string, string | number>;
  status: MemoStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  authorName: string;
  isAuthor: boolean;
  department: { id: string; name: string } | null;
  attachments: MemoAttachmentView[];
  route: MemoRouteStepView[];
  /** Задача, по которой этот человек может решать прямо сейчас. */
  myTaskId: string | null;
  events: MemoEventView[];
  /** Таблица расходов. У остальных типов — null. */
  extraExpense: MemoExtraExpenseView | null;
  canEdit: boolean;
  canCancel: boolean;
}

export interface MemoTaskRow {
  taskId: string;
  stepNo: number;
  roleName: string;
  dueAt: string | null;
  activatedAt: string | null;
  memoId: string;
  number: string | null;
  memoType: MemoType;
  title: string;
  amount: string | null;
  currency: string | null;
  justification: string;
  authorName: string;
}

export interface MemoAnalytics {
  byStatus: Partial<Record<MemoStatus, number>>;
  byType: Partial<Record<MemoType, number>>;
  /** Суммы раздельно по валютам: курсов в базе нет, единый итог был бы выдуман. */
  approvedByCurrency: {
    currency: string | null;
    total: string;
    count: number;
  }[];
  avgHoursToDecision: number | null;
  decidedCount: number;
  overdueTasks: number;
  decisionsByRole: { roleId: string; count: number }[];
  waitByRole: {
    roleId: string;
    roleName: string;
    avgHours: number;
    count: number;
  }[];
}

export interface MemoInput {
  memoType: MemoType;
  title: string;
  departmentId?: string;
  justification: string;
  amount?: number;
  currency?: string;
  payload?: Record<string, string | number>;
}

export interface MemoQuery {
  search?: string;
  status?: string;
  memoType?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// Настройки раздела

export interface MemoDepartmentRow {
  id: string;
  name: string;
  isActive: boolean;
  _count?: { memos: number };
}

export interface MemoRoleRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  members: { employeeId: string; name: string; telegramLinked: boolean }[];
}

export interface MemoRouteRow {
  id: string;
  memoType: MemoType;
  name: string;
  isActive: boolean;
  versionNo: number;
  steps: {
    stepNo: number;
    roleId: string;
    roleName: string;
    isMandatory: boolean;
    slaHours: number | null;
  }[];
}

export interface MemoCandidate {
  id: string;
  name: string;
  email: string | null;
  login: string | null;
  memoTelegramLink: { unlinkedAt: string | null } | null;
}

export interface MemoLinkStatus {
  employeeId: string;
  name: string;
  roles: string[];
  linked: boolean;
  linkedAt: string | null;
}

export const memoApi = {
  meta(): Promise<MemoMeta> {
    return req<MemoMeta>('/worker/memos/meta');
  },
  list(query: MemoQuery = {}): Promise<MemoListResponse> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const q = params.toString();
    return req<MemoListResponse>(`/worker/memos${q ? `?${q}` : ''}`);
  },
  myTasks(): Promise<MemoTaskRow[]> {
    return req<MemoTaskRow[]>('/worker/memos/my-tasks');
  },
  byId(id: string): Promise<MemoCard> {
    return req<MemoCard>(`/worker/memos/${id}`);
  },
  readiness(id: string): Promise<{ ready: boolean; problems: string[] }> {
    return req<{ ready: boolean; problems: string[] }>(
      `/worker/memos/${id}/readiness`,
    );
  },
  create(input: MemoInput): Promise<{ id: string; status: MemoStatus }> {
    return req<{ id: string; status: MemoStatus }>('/worker/memos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  update(
    id: string,
    input: Partial<MemoInput>,
  ): Promise<{ id: string; status: MemoStatus }> {
    return req<{ id: string; status: MemoStatus }>(`/worker/memos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  submit(
    id: string,
  ): Promise<{ number: string; stepNo: number; resubmitted: boolean }> {
    return req<{ number: string; stepNo: number; resubmitted: boolean }>(
      `/worker/memos/${id}/submit`,
      { method: 'POST' },
    );
  },
  cancel(id: string, comment?: string): Promise<{ status: 'cancelled' }> {
    return req<{ status: 'cancelled' }>(`/worker/memos/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },
  decide(
    id: string,
    taskId: string,
    decision: MemoDecisionKind,
    comment?: string,
  ): Promise<{ outcome: string; memoStatus: MemoStatus }> {
    return req<{ outcome: string; memoStatus: MemoStatus }>(
      `/worker/memos/${id}/tasks/${taskId}/decision`,
      { method: 'POST', body: JSON.stringify({ decision, comment }) },
    );
  },
  /** Загрузка вложения. Content-Type не ставим — его задаёт FormData. */
  async addAttachment(id: string, file: File): Promise<MemoAttachmentView> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/worker/memos/${id}/attachments`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const raw = body?.message?.message ?? body?.message ?? body?.error;
      throw new Error(
        Array.isArray(raw)
          ? raw.join('; ')
          : typeof raw === 'string'
            ? raw
            : 'Не удалось загрузить',
      );
    }
    return res.json();
  },
  removeAttachment(id: string, attachmentId: string): Promise<{ ok: true }> {
    return req<{ ok: true }>(
      `/worker/memos/${id}/attachments/${attachmentId}`,
      {
        method: 'DELETE',
      },
    );
  },
  /**
   * Вложение грузим запросом с токеном и отдаём blob-ссылку: просмотр файла
   * не умеет слать заголовок авторизации, а в открытом доступе счета лежать
   * не должны.
   */
  async attachmentUrl(id: string, attachmentId: string): Promise<string> {
    const res = await fetch(
      `/api/worker/memos/${id}/attachments/${attachmentId}`,
      {
        headers: authHeaders(),
      },
    );
    if (!res.ok) throw new Error('Вложение недоступно');
    return URL.createObjectURL(await res.blob());
  },
  analytics(from?: string, to?: string): Promise<MemoAnalytics> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString();
    return req<MemoAnalytics>(`/worker/memos/analytics${q ? `?${q}` : ''}`);
  },

  admin: {
    departments(): Promise<MemoDepartmentRow[]> {
      return req<MemoDepartmentRow[]>('/worker/memos/admin/departments');
    },
    createDepartment(name: string): Promise<MemoDepartmentRow> {
      return req<MemoDepartmentRow>('/worker/memos/admin/departments', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    updateDepartment(
      id: string,
      input: { name?: string; isActive?: boolean },
    ): Promise<MemoDepartmentRow> {
      return req<MemoDepartmentRow>(`/worker/memos/admin/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    roles(): Promise<MemoRoleRow[]> {
      return req<MemoRoleRow[]>('/worker/memos/admin/roles');
    },
    createRole(code: string, name: string): Promise<{ id: string }> {
      return req<{ id: string }>('/worker/memos/admin/roles', {
        method: 'POST',
        body: JSON.stringify({ code, name }),
      });
    },
    updateRole(
      id: string,
      name: string,
      isActive?: boolean,
    ): Promise<{ id: string }> {
      return req<{ id: string }>(`/worker/memos/admin/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, isActive }),
      });
    },
    addMember(roleId: string, employeeId: string): Promise<{ id: string }> {
      return req<{ id: string }>(
        `/worker/memos/admin/roles/${roleId}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ employeeId }),
        },
      );
    },
    removeMember(roleId: string, employeeId: string): Promise<{ ok: true }> {
      return req<{ ok: true }>(
        `/worker/memos/admin/roles/${roleId}/members/${employeeId}`,
        {
          method: 'DELETE',
        },
      );
    },
    candidates(): Promise<MemoCandidate[]> {
      return req<MemoCandidate[]>('/worker/memos/admin/candidates');
    },
    routes(): Promise<MemoRouteRow[]> {
      return req<MemoRouteRow[]>('/worker/memos/admin/routes');
    },
    createRoute(
      memoType: MemoType,
      name: string,
      steps: { roleId: string; isMandatory?: boolean; slaHours?: number }[],
    ): Promise<{ id: string }> {
      return req<{ id: string }>('/worker/memos/admin/routes', {
        method: 'POST',
        body: JSON.stringify({ memoType, name, steps }),
      });
    },
    saveSteps(
      id: string,
      steps: { roleId: string; isMandatory?: boolean; slaHours?: number }[],
    ): Promise<{ id: string; versionNo: number }> {
      return req<{ id: string; versionNo: number }>(
        `/worker/memos/admin/routes/${id}/steps`,
        {
          method: 'POST',
          body: JSON.stringify({ steps }),
        },
      );
    },
    setRouteActive(
      id: string,
      isActive: boolean,
    ): Promise<{ id: string; isActive: boolean }> {
      return req<{ id: string; isActive: boolean }>(
        `/worker/memos/admin/routes/${id}/active`,
        {
          method: 'POST',
          body: JSON.stringify({ isActive }),
        },
      );
    },
    links(): Promise<MemoLinkStatus[]> {
      return req<MemoLinkStatus[]>('/worker/memos/admin/telegram-links');
    },
    /** Код показывается ровно один раз — в этом ответе. */
    issueCode(employeeId: string): Promise<{
      employeeId: string;
      name: string;
      code: string;
      expiresAt: string;
    }> {
      return req<{
        employeeId: string;
        name: string;
        code: string;
        expiresAt: string;
      }>('/worker/memos/admin/telegram-code', {
        method: 'POST',
        body: JSON.stringify({ employeeId }),
      });
    },
    unlink(employeeId: string): Promise<{ ok: true }> {
      return req<{ ok: true }>(
        `/worker/memos/admin/telegram-links/${employeeId}`,
        {
          method: 'DELETE',
        },
      );
    },
  },
};
