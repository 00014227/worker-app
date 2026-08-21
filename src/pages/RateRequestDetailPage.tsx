import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, Fragment } from "react";
import {
  ArrowLeft,
  Trophy,
  CheckCircle2,
  Send,
  Loader2,
  MapPin,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronRight,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import {
  tenderApi,
  TenderDetail,
  TenderStatus,
  DeliveryStatus,
  TenderReplyRow,
  TENDER_MODE_LABELS,
  PRICE_BASIS_LABELS,
  AwardStatus,
  AWARD_STATUS_LABELS,
  DECLINE_REASON_LABELS,
  RouteBenchmark,
  TenderBidRow,
} from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { subscribeToTender, getSocket } from "@/lib/socket";
import SupplierChat from "@/components/SupplierChat";
import { confirmOnStand } from "../lib/env";

const STATUS: Record<TenderStatus, { label: string; cls: string }> = {
  draft: {
    label: "Черновик",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  },
  sent: { label: "Отправлен", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  collecting: {
    label: "Сбор ставок",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  award_pending: {
    label: "Ждём подтверждения",
    cls: "bg-violet-50 text-violet-700 border-violet-200",
  },
  decided: {
    label: "Выбран",
    cls: "bg-green-50 text-green-700 border-green-200",
  },
  cancelled: { label: "Отменён", cls: "bg-red-50 text-red-700 border-red-200" },
};

const AWARD_BADGE: Record<AwardStatus, string> = {
  pending: "bg-violet-50 text-violet-700 border-violet-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  refused: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-slate-100 text-slate-600 border-slate-200",
};

const DELIVERY: Record<DeliveryStatus, { label: string; cls: string }> = {
  pending: { label: "Ожидает", cls: "text-slate-500" },
  sent: { label: "Отправлено", cls: "text-blue-600" },
  error: { label: "Ошибка", cls: "text-red-600" },
};

function error_msg(raw: string) {
  const str = raw.toLowerCase();
  // Часть причин бэкенд формулирует сам и уже по-русски («нет Telegram у
  // подрядчика», «нет email у подрядчика»). Такие показываем как есть: они
  // конкретнее любого нашего обобщения.
  if (!/[a-z]/.test(str)) return raw;
  if (
    str.includes("could not find the input entity") ||
    str.includes("peer_id_invalid")
  )
    return "Не указан @username или номер телефона (или нужен начатый диалог)";
  if (str.includes("username_not_occupied") || str.includes("no user has"))
    return "Username не существует";
  if (str.includes("user_privacy_restricted"))
    return "Настройки приватности запрещают сообщения";
  if (str.includes("blocked") || str.includes("can't write"))
    return "Подрядчик заблокировал аккаунт";
  if (str.includes("flood_wait") || str.includes("too many requests"))
    return "Лимит Telegram — попробуйте позже";
  if (str.includes("auth_key") || str.includes("unauthorized"))
    return "Telegram-аккаунт не авторизован";
  return "Не удалось отправить";
}

const CHANNEL_LABEL: Record<string, string> = {
  telegram: "TG",
  email: "Почта",
  both: "TG+Почта",
};

function money(amount: string | number | null, currency: string | null) {
  if (amount == null) return "—";
  return `${Number(amount).toLocaleString("ru-RU")} ${currency ?? ""}`.trim();
}

/**
 * Курсы к USD — те же значения, что на бэке (FX_RATES_USD). Нужны только чтобы
 * показать порядок величины в валюте тендера, счета по ним не выставляют.
 */
const RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  RUB: 0.011,
  UZS: 0.000079,
  KZT: 0.0019,
  CNY: 0.14,
};

/** Цена в валюте тендера. null = курс неизвестен → сравнивать напрямую нельзя. */
function comparable(
  amount: string | null,
  from: string | null,
  to: string | null,
): number | null {
  if (amount == null || !from || !to) return null;
  if (from === to) return Number(amount);
  const a = RATES_TO_USD[from];
  const b = RATES_TO_USD[to];
  if (!a || !b) return null;
  return (Number(amount) * a) / b;
}

/**
 * Цены, которые подрядчик присылал по этому тендеру, в порядке поступления.
 * Подряд идущие одинаковые суммы схлопываем: подрядчик мог прислать несколько
 * сообщений, не меняя цену, и «11000 → 11000 → 2500» читалось бы как торг.
 */
function priceTrail(
  bids: TenderBidRow[],
  supplierId: string,
): Array<{ amount: number; currency: string | null }> {
  const out: Array<{ amount: number; currency: string | null }> = [];
  for (const b of bids) {
    if (b.supplierId !== supplierId || b.amount == null) continue;
    const amount = Number(b.amount);
    if (!Number.isFinite(amount)) continue;
    if (out.length > 0 && out[out.length - 1].amount === amount) continue;
    out.push({ amount, currency: b.currency });
  }
  return out;
}

/** Ставка неоднозначна: подрядчик назвал несколько цен при разных условиях. */
function isAmbiguous(r: TenderReplyRow): boolean {
  return (r.priceOptions?.length ?? 0) > 1;
}

/**
 * Медиана по ВСЕМ маршрутам ориентиром быть не может (в одной выборке и 200, и
 * 21000), поэтому глобальный уровень показываем как «нет истории», а не цифрой.
 */
function benchmarkUsable(b: RouteBenchmark | null): b is RouteBenchmark {
  return !!b && b.level !== "global" && b.medianPurchase != null;
}

/** Отклонение от ориентира в процентах; null — сравнивать не с чем. */
function deviationPct(
  r: TenderReplyRow,
  tenderCurrency: string | null,
  b: RouteBenchmark | null,
): number | null {
  if (!benchmarkUsable(b) || r.amount == null) return null;
  const price = comparable(r.amount, r.currency, b.currency ?? tenderCurrency);
  if (price == null || !b.medianPurchase) return null;
  return ((price - b.medianPurchase) / b.medianPurchase) * 100;
}

export default function RateRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  /** Ответ, у которого раскрыт исходный текст сообщения. */
  const [openRawId, setOpenRawId] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);
  const [benchmark, setBenchmark] = useState<RouteBenchmark | null>(null);
  /** Подрядчик, с которым открыт чат. */
  const [chatWith, setChatWith] = useState<{ id: string; name: string } | null>(null);
  /** Из уведомления пришли «в переписку с подрядчиком» — открываем её сразу. */
  const requestedChatId = (location.state as { openChatWith?: string } | null)?.openChatWith;

  const load = useCallback(() => {
    if (!id) return;
    tenderApi.tenders
      .get(id)
      .then(setTender)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  /**
   * Фоновое обновление: только данные. Ошибку глушим и спиннер не трогаем —
   * моргнувшая сеть не должна подменять таблицу со ставками текстом ошибки,
   * а мигающий спиннер раз в цикл раздражал бы больше, чем помогал.
   */
  const refresh = useCallback(() => {
    if (!id) return;
    tenderApi.tenders.get(id).then(setTender).catch(() => undefined);
  }, [id]);

  // Живые ставки: сервер сам сообщает, что по запросу что-то изменилось.
  // Перечитываем карточку целиком — ранги считает бэкенд, и собирать их на
  // клиенте по кусочкам значит рано или поздно разойтись с истиной.
  useEffect(() => {
    if (!id) return;
    return subscribeToTender(id, refresh);
  }, [id, refresh]);

  /**
   * Запасной путь. Сокет может не подняться — сетевая политика офиса, упавший
   * шлюз, отсутствующий VITE_WS_URL. Логист не должен из-за этого остаться
   * перед застывшей страницей, поэтому при отсутствии связи включаем опрос.
   */
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!timer) timer = setInterval(refresh, 20_000);
    };
    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (!socket) startPolling();
    else {
      if (!socket.connected) startPolling();
      socket.on("connect", stopPolling);
      socket.on("disconnect", startPolling);
      socket.on("connect_error", startPolling);
    }

    return () => {
      stopPolling();
      socket?.off("connect", stopPolling);
      socket?.off("disconnect", startPolling);
      socket?.off("connect_error", startPolling);
    };
  }, [id, refresh]);

  // Рыночный ориентир по маршруту — грузим отдельно, чтобы пустая история
  // аналитики не мешала показать сам тендер.
  useEffect(() => {
    if (!tender) return;
    tenderApi.tenders
      .benchmark({
        origin: tender.origin,
        destination: tender.destination,
        originCountry: tender.originCountry,
        destinationCountry: tender.destinationCountry,
        currency: tender.currency,
      })
      .then(setBenchmark)
      .catch(() => setBenchmark(null));
  }, [tender?.id, tender?.origin, tender?.destination]);

  useEffect(() => {
    if (!requestedChatId || !tender) return;
    const name =
      tender.invites.find((i) => i.supplier.id === requestedChatId)?.supplier.name ??
      tender.replies.find((r) => r.supplierId === requestedChatId)?.supplier.name;
    if (!name) return;
    setChatWith({ id: requestedChatId, name });
    // Просьбу из уведомления гасим сразу после открытия. Иначе закрытие чата
    // возвращало бы нас в этот же эффект — и он открывал бы переписку снова,
    // не давая её закрыть. Заодно перезагрузка страницы больше её не воскрешает.
    navigate(".", { replace: true, state: null });
  }, [requestedChatId, tender, navigate]);

  const send = async () => {
    if (!id) return;
    // Счётчик считаем здесь, а не берём pendingCount ниже: тот объявлен после
    // раннего выхода по !tender и в этом замыкании существовать не обязан.
    const pending =
      tender?.invites.filter((i) => i.deliveryStatus !== "sent").length ?? 0;
    if (
      !confirmOnStand(
        `Приглашения уйдут реальным подрядчикам в Telegram (${pending}).`,
      )
    )
      return;
    setSending(true);
    setError(null);
    try {
      setTender(await tenderApi.tenders.send(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const select = async (supplierId: string) => {
    if (!id) return;
    if (
      !confirmOnStand("Выбранному подрядчику уйдёт запрос подтверждения.")
    )
      return;
    setSelectingId(supplierId);
    setError(null);
    try {
      setTender(await tenderApi.tenders.select(id, supplierId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSelectingId(null);
    }
  };

  const requestImprovement = async () => {
    if (!id) return;
    if (
      !confirmOnStand(
        "Подрядчикам дороже лидера уйдёт предложение улучшить ставку.",
      )
    )
      return;
    setImproving(true);
    setError(null);
    try {
      setTender(await tenderApi.tenders.requestImprovement(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImproving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <Loader2 className="animate-spin mx-auto mb-2" /> Загрузка…
      </div>
    );
  }
  if (!tender) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Тендер не найден
      </div>
    );
  }

  const st = STATUS[tender.status];
  const pendingCount = tender.invites.filter(
    (i) => i.deliveryStatus !== "sent",
  ).length;
  const canSend =
    tender.status !== "decided" &&
    tender.status !== "cancelled" &&
    pendingCount > 0;
  const decided = tender.status === "decided";
  const awardPending = tender.status === "award_pending";
  // Торг возможен один раз и только пока есть с чем работать.
  const pricedCount = tender.replies.filter(
    (r) => r.accepted !== false && r.amount != null,
  ).length;
  const canImprove =
    !decided &&
    !awardPending &&
    tender.status !== "cancelled" &&
    !tender.improvementRequestedAt &&
    pricedCount > 1;
  // Replies ordered by rank (nulls last).
  const replies = [...tender.replies].sort(
    (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <button
        onClick={() => navigate("/rate-requests")}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
      >
        <ArrowLeft size={13} /> К запросам
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header card */}
      <Card>
        <CardContent className="pt-1">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin size={16} className="text-primary" />
                <span className="font-bold text-base">{tender.origin}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-bold text-base">
                  {tender.destination}
                </span>
                {tender.mode && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {TENDER_MODE_LABELS[tender.mode]}
                  </span>
                )}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium border",
                    st.cls,
                  )}
                >
                  {st.label}
                </span>
              </div>
              <div className="flex gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground flex-wrap">
                {/* Дата погрузки — @db.Date (UTC-полночь): без timeZone съезжает на день назад */}
                {tender.loadingDate && (
                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> Погрузка:{" "}
                    {new Date(tender.loadingDate).toLocaleDateString("ru-RU", {
                      timeZone: "UTC",
                    })}
                  </span>
                )}
                {tender.weightKg && (
                  <span>
                    ⚖️ {Number(tender.weightKg).toLocaleString("ru-RU")} кг
                  </span>
                )}
                {tender.cargoType && (
                  <span>
                    📦 {tender.cargoType}
                    {tender.cargo ? ` — ${tender.cargo}` : ""}
                  </span>
                )}
                {tender.hazardClass && (
                  <span className="text-red-600">☣️ {tender.hazardClass}</span>
                )}
                {tender.temperatureRegime && (
                  <span className="text-sky-600">
                    🌡 {tender.temperatureRegime}
                  </span>
                )}
                {tender.vehicleType && (
                  <span>
                    🚚 {tender.vehicleType}
                    {tender.vehicleCount ? ` × ${tender.vehicleCount}` : ""}
                  </span>
                )}
                {tender.loadingMethod && <span>↕️ {tender.loadingMethod}</span>}
                {tender.hsCodes && <span>🔢 ТНВЭД: {tender.hsCodes}</span>}
                {tender.incoterms && <span>📑 {tender.incoterms}</span>}
                {tender.bidDeadline && (
                  <span
                    className={cn(
                      new Date(tender.bidDeadline) < new Date() &&
                        "text-red-600",
                    )}
                  >
                    ⏳ приём ставок до:{" "}
                    {new Date(tender.bidDeadline).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {tender.cargoValue && (
                  <span>
                    💰 {Number(tender.cargoValue).toLocaleString("ru-RU")}{" "}
                    {tender.currency ?? ""}
                  </span>
                )}
                {tender.exportCustoms && (
                  <span>🛃 экспорт: {tender.exportCustoms}</span>
                )}
                {tender.importCustoms && (
                  <span>🛃 импорт: {tender.importCustoms}</span>
                )}
                {tender.conditions && (
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} /> {tender.conditions}
                  </span>
                )}
                {tender.comment && (
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} /> {tender.comment}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canSend && (
                <button
                  onClick={send}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  {sending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  Отправить ({pendingCount})
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invites / delivery */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm">
            Подрядчики ({tender.invites.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            {tender.invites.map((inv) => {
              const d = DELIVERY[inv.deliveryStatus];
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-2.5 gap-3"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium">
                      {inv.supplier.name}
                    </span>
                    {inv.supplier.telegramUsername && (
                      <span className="text-xs text-muted-foreground ml-2">
                        @{inv.supplier.telegramUsername.replace("@", "")}
                      </span>
                    )}
                    {inv.errorMessage && (
                      <div
                        className="text-xs text-red-600 flex items-center gap-1 mt-0.5"
                        title={String(inv.errorMessage)}
                      >
                        <AlertTriangle size={11} />
                        {error_msg(inv.errorMessage)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {CHANNEL_LABEL[inv.channel] ?? inv.channel}
                    </span>
                    {inv.telegramAccount && (
                      <span className="text-muted-foreground hidden sm:inline">
                        {inv.telegramAccount.phone}
                      </span>
                    )}
                    {inv.reminderCount > 0 && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Clock size={11} /> {inv.reminderCount}
                      </span>
                    )}
                    <span className={cn("font-medium", d.cls)}>{d.label}</span>
                    <button
                      onClick={() =>
                        setChatWith({ id: inv.supplier.id, name: inv.supplier.name })
                      }
                      title="Переписка с подрядчиком"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MessageSquare size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {tender.invites.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Подрядчики не добавлены
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Replies / ranking */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
            Ответы и ставки ({replies.length})
            {tender.recommendedSupplierId && !awardPending && !decided && (
              <span className="flex items-center gap-1 text-xs font-normal text-violet-600">
                <Sparkles size={12} /> ИИ-рекомендация выделена
              </span>
            )}
            <span className="ml-auto flex items-center gap-2">
              {tender.improvementRequestedAt && (
                <span className="text-xs font-normal text-muted-foreground">
                  Торг проведён
                  {tender.improvementDeadline
                    ? ` · до ${new Date(tender.improvementDeadline).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </span>
              )}
              {canImprove && (
                <button
                  onClick={requestImprovement}
                  disabled={improving}
                  title="Тем, кто дороже лидера, уйдёт «готовы улучшить?». Лидера не трогаем. Раунд один."
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-40 transition-colors"
                >
                  {improving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  Запросить лучшую цену
                </button>
              )}
            </span>
          </CardTitle>
          {awardPending && (
            <p className="text-xs text-violet-700 mt-1.5">
              Предложение отправлено победителю. Остальным ничего не сообщаем,
              пока он не подтвердит
              {tender.awardDeadline
                ? ` — ждём до ${new Date(tender.awardDeadline).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                : ""}
              .
            </p>
          )}
          {/* Рыночный ориентир: всегда с размером выборки, чтобы не выглядеть точнее, чем есть. */}
          {benchmark && (
            <div className="mt-2 flex items-start gap-1.5 text-xs">
              <BarChart3
                size={12}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              {benchmarkUsable(benchmark) ? (
                <p className="text-muted-foreground">
                  Ориентир
                  {benchmark.level === "country"
                    ? ` по направлению ${benchmark.scope}`
                    : ""}
                  : медиана закупок{" "}
                  <span className="font-medium text-foreground">
                    {money(benchmark.medianPurchase, benchmark.currency)}
                  </span>
                  {benchmark.lastPurchase != null && (
                    <>
                      {" "}
                      · последняя{" "}
                      {money(benchmark.lastPurchase, benchmark.currency)}
                    </>
                  )}
                  {benchmark.minBid != null && benchmark.maxBid != null && (
                    <>
                      {" "}
                      · ставки {money(benchmark.minBid, null)}–
                      {money(benchmark.maxBid, benchmark.currency)}
                    </>
                  )}
                  {" · "}
                  <span className={cn(!benchmark.reliable && "text-amber-700")}>
                    {benchmark.reliable
                      ? `по ${benchmark.purchases} закупкам за ${benchmark.days} дн`
                      : `мало данных: ${benchmark.purchases} закупк${benchmark.purchases === 1 ? "а" : "и"}`}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  По этому маршруту истории закупок пока нет — ориентир
                  появится, когда наберутся сделки.
                </p>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0 px-0">
          {replies.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Ответов пока нет — придут из Telegram
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Подрядчик
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Цена</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Сравнимая
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Срок</th>
                    <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                      Условия
                    </th>
                    <th className="px-4 py-2 text-center font-medium">ИИ</th>
                    <th className="px-4 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {replies.map((r) => {
                    const recommended =
                      tender.recommendedSupplierId === r.supplierId;
                    const ambiguous = isAmbiguous(r);
                    const open = openRawId === r.id;
                    const conv = comparable(
                      r.amount,
                      r.currency,
                      tender.currency,
                    );
                    const crossCurrency = !!(
                      r.currency &&
                      tender.currency &&
                      r.currency !== tender.currency
                    );
                    return (
                      <Fragment key={r.id}>
                        <tr
                          className={cn(
                            recommended && !decided && "bg-violet-50/50",
                            r.isSelected && "bg-green-50/60",
                          )}
                        >
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.rank ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">
                                {r.supplier.name}
                              </span>
                              {recommended && !decided && (
                                <Sparkles
                                  size={12}
                                  className="text-violet-500"
                                />
                              )}
                              {r.isSelected && (
                                <Trophy size={12} className="text-green-600" />
                              )}
                              {r.isLate && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  после дедлайна
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              {r.accepted === false && (
                                <span className="text-xs text-red-500">
                                  отказ
                                </span>
                              )}
                              {r.declineReason && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-700 border border-red-200">
                                  {DECLINE_REASON_LABELS[r.declineReason]}
                                </span>
                              )}
                              {r.awardStatus && (
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                    AWARD_BADGE[r.awardStatus],
                                  )}
                                >
                                  {AWARD_STATUS_LABELS[r.awardStatus]}
                                </span>
                              )}
                            </div>
                            {/* Источник истины — исходное сообщение подрядчика. */}
                            <button
                              onClick={() => setOpenRawId(open ? null : r.id)}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              {open ? (
                                <ChevronDown size={11} />
                              ) : (
                                <ChevronRight size={11} />
                              )}{" "}
                              исходное сообщение
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="font-semibold">
                              {money(r.amount, r.currency)}
                            </div>
                            {/* Динамика торга: без неё прежняя цена исчезала при
                                новой ставке и экономия была не видна. */}
                            {(() => {
                              const trail = priceTrail(
                                tender.bids ?? [],
                                r.supplierId,
                              );
                              if (trail.length < 2) return null;
                              const first = trail[0];
                              const last = trail[trail.length - 1];
                              const down = last.amount < first.amount;
                              return (
                                <div
                                  className="text-[11px] text-muted-foreground"
                                  title={`Все присланные ставки: ${trail
                                    .map((t) =>
                                      Number(t.amount).toLocaleString("ru-RU"),
                                    )
                                    .join(" → ")}`}
                                >
                                  было{" "}
                                  {Number(first.amount).toLocaleString("ru-RU")}
                                  {trail.length > 2 &&
                                    ` (ставок: ${trail.length})`}
                                  {down && (
                                    <span className="text-green-700 font-medium">
                                      {" "}
                                      −
                                      {Math.round(
                                        ((first.amount - last.amount) /
                                          first.amount) *
                                          100,
                                      )}
                                      %
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {r.priceBasis && (
                              <div className="text-[11px] text-muted-foreground">
                                {PRICE_BASIS_LABELS[r.priceBasis]}
                              </div>
                            )}
                            {/* Отклонение от рыночного ориентира — только заметное (≥15%). */}
                            {(() => {
                              const dev = deviationPct(
                                r,
                                tender.currency,
                                benchmark,
                              );
                              if (dev == null || Math.abs(dev) < 15)
                                return null;
                              const above = dev > 0;
                              return (
                                <div
                                  className={cn(
                                    "text-[11px] font-medium",
                                    above ? "text-amber-700" : "text-green-700",
                                  )}
                                  title={`Медиана закупок по маршруту: ${money(benchmark?.medianPurchase ?? null, benchmark?.currency ?? null)}`}
                                >
                                  {above ? "↑ выше" : "↓ ниже"} ориентира на{" "}
                                  {Math.abs(Math.round(dev))}%
                                </div>
                              );
                            })()}
                            {/* Несколько цен при разных условиях — выбор за логистом, не за ИИ. */}
                            {ambiguous && (
                              <div className="mt-1 text-[11px] text-amber-700 text-left inline-block">
                                <span className="inline-flex items-center gap-1 font-medium">
                                  <AlertTriangle size={11} /> вариантов:{" "}
                                  {r.priceOptions!.length}
                                </span>
                                <ul className="mt-0.5 space-y-0.5">
                                  {r.priceOptions!.map((o, i) => (
                                    <li key={i}>
                                      {money(
                                        o.amount,
                                        o.currency ?? r.currency,
                                      )}
                                      {o.basis
                                        ? ` — ${PRICE_BASIS_LABELS[o.basis]}`
                                        : o.label
                                          ? ` — ${o.label}`
                                          : ""}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap text-xs">
                            {!crossCurrency ? (
                              <span className="text-muted-foreground">—</span>
                            ) : conv != null ? (
                              <span title="Приведено к валюте тендера по справочному курсу">
                                ≈ {money(Math.round(conv), tender.currency)}
                              </span>
                            ) : (
                              <span className="text-amber-700">
                                курс неизвестен
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {r.transitDays != null ? (
                              `${r.transitDays} дн`
                            ) : r.clarifyAskedAt ? (
                              <span
                                className="text-xs text-amber-700"
                                title="Подрядчик не назвал срок — мы уже спросили, ждём ответа"
                              >
                                запросили
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground max-w-[220px] truncate">
                            {r.conditions ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {r.aiConfidence != null
                              ? `${Math.round(Number(r.aiConfidence) * 100)}%`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {r.isSelected ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                                <CheckCircle2 size={13} /> Выбран
                              </span>
                            ) : !decided && !awardPending ? (
                              <button
                                onClick={() => select(r.supplierId)}
                                disabled={selectingId != null}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-40 transition-colors"
                              >
                                {selectingId === r.supplierId ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Trophy size={12} />
                                )}
                                Выбрать
                              </button>
                            ) : null}
                            <button
                              onClick={() =>
                                setChatWith({
                                  id: r.supplierId,
                                  name: r.supplier.name,
                                })
                              }
                              title="Переписка с подрядчиком"
                              className="ml-2 text-muted-foreground hover:text-foreground transition-colors align-middle"
                            >
                              <MessageSquare size={14} />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-muted/20">
                            <td />
                            <td colSpan={7} className="px-4 py-3">
                              <div className="text-[11px] text-muted-foreground mb-1">
                                Как написал подрядчик ·{" "}
                                {new Date(r.receivedAt).toLocaleString(
                                  "ru-RU",
                                  { timeZone: "Asia/Tashkent" },
                                )}
                              </div>
                              <pre className="whitespace-pre-wrap break-words text-xs bg-background border rounded-lg p-3">
                                {r.rawText}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages drawer */}
      {chatWith && id && (
        <SupplierChat
          tenderId={id}
          supplier={chatWith}
          onClose={() => setChatWith(null)}
        />
      )}

    </div>
  );
}
