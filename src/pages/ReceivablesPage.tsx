import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CalendarDays,
  HandCoins,
  Search,
  RefreshCw,
  Loader2,
  Play,
  Ban,
  MailX,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  receivablesApi,
  DebtorRow,
  DebtorDocument,
  DebtorLetter,
  DebtMailMode,
  DebtLetterStatus,
  DebtStage,
  DebtDeferralReason,
  DebtorDeferral,
  DebtorStop,
  DebtHoliday,
  DebtStopKind,
  DebtStopReason,
  DEFERRAL_REASON_LABELS,
  STOP_KIND_LABELS,
  MoneyByCurrency,
} from '../lib/api';
import { getUser } from '../lib/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUS: Record<DebtLetterStatus, { label: string; className: string }> = {
  dry_run: { label: 'Только в журнале', className: 'text-muted-foreground' },
  // Из старой схемы с претензией в системе; новые письма так не помечаются.
  pending_approval: {
    label: 'Ждал утверждения (старая схема)',
    className: 'text-muted-foreground',
  },
  queued: { label: 'В очереди на отправку', className: 'text-blue-600' },
  sending: { label: 'Отправляется', className: 'text-blue-600' },
  sent: { label: 'Отправлено', className: 'text-green-600' },
  error: { label: 'Ошибка отправки', className: 'text-red-600' },
  cancelled: { label: 'Отменено', className: 'text-muted-foreground' },
};

const MODE: Record<
  DebtMailMode,
  { label: string; hint: string; className: string }
> = {
  'dry-run': {
    label: 'Режим проверки',
    hint: 'письма только записываются в журнал, клиентам ничего не уходит',
    className: 'border-border bg-muted/30 text-muted-foreground',
  },
  'test': {
    label: 'Тестовый режим',
    hint: 'письма уходят на тестовый ящик, а не клиентам',
    className: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  'live': {
    label: 'Боевой режим',
    hint: 'письма уходят клиентам',
    className: 'border-red-300 bg-red-50 text-red-800',
  },
};

/** Почему письмо не ушло — для итога прогона. */
const STOP_REASON_LABELS: Record<DebtStopReason, string> = {
  no_email: 'нет email',
  dispute: 'спор по сумме',
  claim: 'претензия направлена',
  no_term: 'в 1С нет срока или даты АВР',
};

/** Куда уйдут письма после прогона — для текста подтверждения. */
const WHERE_MANY: Record<DebtMailMode, string> = {
  'dry-run': 'останутся только в журнале (режим проверки)',
  'test': 'уйдут на тестовый ящик',
  'live': 'уйдут клиентам',
};

const fmtMoney = (m: MoneyByCurrency) =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
    Number(m.amount),
  )} ${m.currency}`;

/** YYYY-MM-DD → ДД.ММ.ГГГГ без Date: иначе часовой пояс сдвинет день. */
const fmtDate = (ymd: string) => ymd.split('-').reverse().join('.');

/** Сегодня по Ташкенту, YYYY-MM-DD — по этому календарю считаются просрочка и отсрочка. */
const todayYmd = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(
    new Date(),
  );

const addDaysYmd = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** ДД.ММ, а для сегодняшней даты — «сегодня». */
const fmtShort = (ymd: string) =>
  ymd === todayYmd()
    ? 'сегодня'
    : ymd.split('-').reverse().slice(0, 2).join('.');

/** Дольше нельзя — бэкенд не примет (DEBT_DEFERRAL_MAX_DAYS). */
const DEFERRAL_MAX_DAYS = 90;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Время прогона по Ташкенту: «вторник, 20 октября в 10:00». */
const fmtRun = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent',
  });

/** Итог по валютам для шапки: точность до копейки тут не нужна. */
function sumMoney(items: MoneyByCurrency[]): MoneyByCurrency[] {
  const sums = new Map<string, number>();
  for (const m of items) {
    sums.set(m.currency, (sums.get(m.currency) ?? 0) + Number(m.amount));
  }
  return [...sums].map(([currency, amount]) => ({
    currency,
    amount: String(amount),
  }));
}

/** Цвет дней просрочки: 30+ — письмо 5, 14+ — письмо 4. */
function daysClass(days: number | null) {
  if (days === null) return 'text-muted-foreground';
  if (days >= 30) return 'text-red-600 font-semibold';
  if (days >= 14) return 'text-amber-600 font-medium';
  return '';
}

export default function ReceivablesPage() {
  const user = getUser();
  // Бэкенд всё равно проверит права — здесь просто не показываем лишние кнопки.
  const canAct = !!(user?.isAdmin || user?.isLawyer);

  const [data, setData] = useState<{
    mode: DebtMailMode;
    testRecipient: string;
    lettersReady: boolean;
    stages: DebtStage[];
    nextRun: string | null;
    rows: DebtorRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyStops, setOnlyStops] = useState(false);
  const [onlyDeferred, setOnlyDeferred] = useState(false);
  /** Этап из сводки сверху; 0 — «ещё рано», null — все. */
  const [stageFilter, setStageFilter] = useState<number | null>(null);
  const [selected, setSelected] = useState<DebtorRow | null>(null);
  const [running, setRunning] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [runResult, setRunResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Состояние меняем только в колбэках запроса — эффект при открытии
  // страницы не должен синхронно дёргать setState (лишний рендер).
  const fetchList = useCallback(
    () =>
      receivablesApi
        .list()
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const load = () => {
    setLoading(true);
    fetchList();
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (onlyStops && r.stops.length === 0) return false;
      if (onlyDeferred && !r.deferral) return false;
      if (stageFilter !== null && (r.stage?.stage ?? 0) !== stageFilter)
        return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.inn ?? '').includes(q);
    });
  }, [data, search, onlyStops, onlyDeferred, stageFilter]);

  // Сводка по этапам: на каком письме клиент сейчас (самый поздний наступивший
  // этап по его актам), сколько клиентов и денег. Клик — фильтр.
  const buckets = useMemo(() => {
    if (!data) return [];
    const stages = [...data.stages].sort((a, b) => a.stage - b.stage);
    return [
      { key: 0, label: 'Писем ещё не было', hint: 'до первого письма' },
      ...stages.map((s) => ({ key: s.stage, label: s.title, hint: s.when })),
    ].map((b) => {
      const inBucket = data.rows.filter((r) => (r.stage?.stage ?? 0) === b.key);
      return {
        ...b,
        count: inBucket.length,
        overdue: sumMoney(inBucket.flatMap((r) => r.overdue)),
      };
    });
  }, [data]);
  const deferredCount = (data?.rows ?? []).filter((r) => r.deferral).length;

  const totalOverdue = useMemo(
    () => sumMoney((data?.rows ?? []).flatMap((r) => r.overdue)),
    [data],
  );
  const stopped = (data?.rows ?? []).filter((r) => r.stops.length).length;

  const run = async () => {
    if (!data) return;
    if (
      !window.confirm(
        `Прогнать рассылку сейчас, не дожидаясь расписания?\n\nСначала подтянем свежие долги из 1С — это до минуты. Новые письма ${WHERE_MANY[data.mode]}.`,
      )
    )
      return;
    setRunning(true);
    setRunResult(null);
    try {
      const r = await receivablesApi.run();
      const parts = [`Создано писем: ${r.created}`];
      const reasons = new Map<DebtStopReason, number>();
      for (const s of r.stopped)
        reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
      if (reasons.size)
        parts.push(
          `не отправлено: ${[...reasons]
            .map(([reason, n]) => `${STOP_REASON_LABELS[reason]} — ${n}`)
            .join(', ')}`,
        );
      if (r.closed) parts.push(`закрыто (долг погашен): ${r.closed}`);
      if (r.sent) parts.push(`отправлено: ${r.sent}`);
      if (r.failed)
        parts.push(`не ушло: ${r.failed} — причина в карточке клиента`);
      setRunResult({ ok: r.failed === 0, text: parts.join(' · ') });
      load();
    } catch (e) {
      setRunResult({ ok: false, text: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Дебиторка</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading && !data
              ? 'Загрузка…'
              : `${data?.rows.length ?? 0} должников · просрочено ${
                  totalOverdue.map(fmtMoney).join(' + ') || '0'
                }${stopped ? ` · со стопом: ${stopped}` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHolidays(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/50 transition-colors"
          >
            <CalendarDays size={13} />
            Праздники
          </button>
          {canAct && (
            <button
              onClick={run}
              disabled={running || !data}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/50 disabled:opacity-40 transition-colors"
            >
              {running ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              Прогнать сейчас
            </button>
          )}
          <button
            onClick={load}
            title="Обновить"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {data && (
        <div
          className={cn(
            'rounded-lg border px-4 py-2.5 text-xs space-y-1',
            MODE[data.mode].className,
          )}
        >
          <div>
            <span className="font-semibold">{MODE[data.mode].label}:</span>{' '}
            {MODE[data.mode].hint}
            {data.mode === 'test' && data.testRecipient
              ? ` (${data.testRecipient})`
              : ''}
            . Письма создаются и отправляются автоматически каждый рабочий день
            в 10:00
            {data.nextRun
              ? ` (ближайший прогон — ${fmtRun(data.nextRun)})`
              : ''}
            , перед этим долги обновляются из 1С. Отсчёт — от даты каждого акта
            и срока оплаты T по договору.
          </div>
          <div className="opacity-80">
            {data.stages
              .map((s) => `${s.stage}. ${s.title} — ${s.when}`)
              .join(' · ')}
            . После письма 5 — претензия вручную (юрист).
          </div>
        </div>
      )}

      {data && !data.lettersReady && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <span className="font-semibold">Подпись писем не заполнена:</span> нет
          контакта (DEBT_CONTACT_*) или организация не настроена. Клиентам
          (боевой режим) письма не уйдут; тестовые и режим проверки работают.
        </div>
      )}

      {runResult && (
        <div
          className={cn(
            'rounded-lg border px-4 py-2 text-xs',
            runResult.ok
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-700',
          )}
        >
          {runResult.text}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {buckets.map((b) => (
            <button
              key={b.key}
              onClick={() =>
                setStageFilter((cur) => (cur === b.key ? null : b.key))
              }
              className={cn(
                'rounded-lg border p-2.5 text-left transition-all hover:bg-muted/40',
                stageFilter === b.key && 'border-primary ring-1 ring-primary',
                b.key === data.stages.length && b.count > 0 && 'bg-red-50',
              )}
            >
              <div className="text-xs font-medium truncate">{b.label}</div>
              <div className="text-[11px] text-muted-foreground">{b.hint}</div>
              <div className="text-lg font-bold leading-tight mt-1">
                {b.count}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {b.overdue.map(fmtMoney).join(' + ') || '—'}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Название или ИНН…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setOnlyStops((v) => !v)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
            onlyStops
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          Со стопом{stopped ? ` · ${stopped}` : ''}
        </button>
        <button
          onClick={() => setOnlyDeferred((v) => !v)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
            onlyDeferred
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          С отсрочкой{deferredCount ? ` · ${deferredCount}` : ''}
        </button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <HandCoins size={26} className="mx-auto mb-2 opacity-30" />
            {loading
              ? 'Загрузка…'
              : data?.rows.length
                ? 'Никого не нашли'
                : 'Должников нет. Долги появятся после выгрузки из 1С.'}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Клиент</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Просрочено
                  </th>
                  <th className="px-4 py-2 text-center font-medium">Дней</th>
                  <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                    Этап
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    Последнее письмо
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr
                    key={r.customerId}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-xs">{r.name}</div>
                      {r.inn && (
                        <div className="text-xs text-muted-foreground">
                          ИНН {r.inn}
                        </div>
                      )}
                      {!r.email && (
                        <div className="text-xs text-red-600 flex items-center gap-1">
                          <MailX size={11} /> нет email — письма не уходят
                        </div>
                      )}
                      {r.organizations.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          кредитор: {r.organizations.join(', ')}
                        </div>
                      )}
                      {r.deferral && (
                        <div className="text-xs text-blue-700 flex items-center gap-1">
                          <CalendarClock size={11} /> отсрочка: новый срок{' '}
                          {fmtShort(r.deferral.until)} ·{' '}
                          {DEFERRAL_REASON_LABELS[
                            r.deferral.reason
                          ].toLowerCase()}
                        </div>
                      )}
                      {r.stops.map((kind) => (
                        <div
                          key={kind}
                          className="text-xs text-red-700 flex items-center gap-1"
                        >
                          <Ban size={11} />{' '}
                          {STOP_KIND_LABELS[kind].toLowerCase()} — писем нет
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap">
                      {r.overdue.length ? (
                        r.overdue.map((m) => (
                          <div key={m.currency}>{fmtMoney(m)}</div>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {r.undated.map((m) => (
                        <div
                          key={`u-${m.currency}`}
                          className="text-muted-foreground"
                          title="В 1С нет акта или срока оплаты: срок не угадываем, письмом не отправляется"
                        >
                          + без срока {fmtMoney(m)}
                        </div>
                      ))}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-center text-xs',
                        daysClass(r.daysOverdue),
                      )}
                    >
                      {r.daysOverdue ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs hidden md:table-cell">
                      {r.stage ? (
                        `${r.stage.stage}. ${r.stage.title}`
                      ) : (
                        <span className="text-muted-foreground">
                          писем ещё не было
                        </span>
                      )}
                      {r.nextLetter && (
                        <div className="text-muted-foreground">
                          далее: письмо {r.nextLetter.stage},{' '}
                          {fmtShort(r.nextLetter.date)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.lastLetter ? (
                        <div>
                          <span
                            className={STATUS[r.lastLetter.status].className}
                          >
                            Письмо {r.lastLetter.stage} ·{' '}
                            {STATUS[r.lastLetter.status].label}
                          </span>
                          <div className="text-muted-foreground">
                            {fmtDateTime(r.lastLetter.createdAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showHolidays && (
        <HolidaysPanel
          onClose={() => setShowHolidays(false)}
          onChanged={load}
        />
      )}

      {selected && data && (
        <DebtorPanel
          row={selected}
          mode={data.mode}
          stages={data.stages}
          canAct={canAct}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/** «30 дн. по договору» / «предоплата» — откуда взят срок оплаты акта. */
function termLabel(d: DebtorDocument): string {
  if (d.termDays === null) return '';
  const days =
    d.termDays === 0 ? 'в день акта' : `${d.termDays} дн. после акта`;
  return d.dueDateSource === 'payment_term' ? `${days} (справочник)` : days;
}

/** Почему клиенту ещё не писали и когда напишем — вместо пустого «писем нет». */
function noLettersReason(row: DebtorRow): string {
  if (!row.email)
    return 'Писем не было: у клиента нет email — ни в карточке 1С, ни в «Клиенты».';
  if (row.stops.length)
    return `Писем нет: ${row.stops.map((k) => STOP_KIND_LABELS[k].toLowerCase()).join(', ')}.`;
  if (!row.nextLetter) return 'Писем этому клиенту ещё не было.';
  const when =
    row.nextLetter.date === todayYmd()
      ? 'при ближайшем прогоне'
      : fmtDate(row.nextLetter.date);
  return `Писем этому клиенту ещё не было. Первое — «${row.nextLetter.title}», ${when}.`;
}

function DebtorPanel({
  row,
  mode,
  stages,
  canAct,
  onClose,
  onChanged,
}: {
  row: DebtorRow;
  mode: DebtMailMode;
  stages: DebtStage[];
  canAct: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [details, setDetails] = useState<{
    documents: DebtorDocument[];
    letters: DebtorLetter[];
    deferrals: DebtorDeferral[];
    stops: DebtorStop[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openLetter, setOpenLetter] = useState<string | null>(null);
  const stageTitle = (n: number) =>
    stages.find((s) => s.stage === n)?.title ?? `Письмо ${n}`;

  const load = useCallback(
    () =>
      receivablesApi
        .details(row.customerId)
        .then(setDetails)
        .catch((e: Error) => setError(e.message)),
    [row.customerId],
  );
  useEffect(() => {
    load();
  }, [load]);
  const changed = () => {
    load();
    onChanged();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full bg-background shadow-xl p-5 overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm">{row.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {row.email ?? (
                <span className="text-red-600">
                  нет email — укажите почту в карточке клиента в 1С (подтянется
                  утром) или в разделе{' '}
                  <Link to="/customers" className="underline">
                    «Клиенты»
                  </Link>
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {!details ? (
          !error && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Загрузка…
            </div>
          )
        ) : (
          <>
            <StopSection
              customerId={row.customerId}
              stops={details.stops}
              canAct={canAct}
              onChanged={changed}
            />

            <DeferralSection
              customerId={row.customerId}
              deferrals={details.deferrals}
              onChanged={changed}
            />

            <section className="space-y-2">
              <div className="text-xs text-muted-foreground">
                НЕОПЛАЧЕННЫЕ АКТЫ
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="py-1.5 text-left font-medium">Документ</th>
                    <th className="py-1.5 text-left font-medium">
                      Срок оплаты
                    </th>
                    <th className="py-1.5 text-right font-medium">Остаток</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {details.documents.map((d) => (
                    <tr key={d.id}>
                      <td className="py-1.5">
                        <div>
                          {d.docDate
                            ? `№ ${d.docNumber} от ${fmtDate(d.docDate)}`
                            : 'Долг без акта в 1С'}
                        </div>
                        {d.contractNumber && (
                          <div className="text-muted-foreground">
                            договор {d.contractNumber}
                          </div>
                        )}
                        {d.stagesDone.length > 0 && (
                          <div className="text-muted-foreground">
                            письма: {d.stagesDone.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5">
                        {d.dueDate && d.deadline && d.daysOverdue !== null ? (
                          <>
                            <div>
                              {fmtDate(d.deadline)}
                              {d.deadline !== d.dueDate && (
                                <span className="text-blue-700">
                                  {' '}
                                  (отсрочка; по договору {fmtDate(d.dueDate)})
                                </span>
                              )}
                            </div>
                            <div className={cn(daysClass(d.daysOverdue))}>
                              {d.daysOverdue > 0
                                ? `просрочка ${d.daysOverdue} дн.`
                                : d.daysOverdue === 0
                                  ? 'срок сегодня'
                                  : `через ${-d.daysOverdue} дн.`}
                            </div>
                            <div className="text-muted-foreground">
                              {termLabel(d)}
                            </div>
                          </>
                        ) : (
                          <div
                            className="text-muted-foreground"
                            title="В 1С нет акта или срока оплаты — срок не угадываем. Письмом не отправляется, случай — в ежедневном отчёте."
                          >
                            срок неизвестен
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        {fmtMoney({ amount: d.balance, currency: d.currency })}
                        {d.paid !== '0.00' && (
                          <div className="text-muted-foreground">
                            из{' '}
                            {fmtMoney({
                              amount: d.amount,
                              currency: d.currency,
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="space-y-2">
              <div className="text-xs text-muted-foreground">ИСТОРИЯ ПИСЕМ</div>
              {details.letters.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {noLettersReason(row)}
                </p>
              )}
              {details.letters.map((l) => (
                <div
                  key={l.id}
                  className={cn(
                    'rounded-lg border p-3 space-y-1.5 text-xs',
                    l.caseClosed && 'opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        Письмо {l.stage}. {stageTitle(l.stage)}
                      </div>
                      <div className="text-muted-foreground">{l.subject}</div>
                    </div>
                    <span
                      className={cn(
                        'whitespace-nowrap',
                        STATUS[l.status].className,
                      )}
                    >
                      {STATUS[l.status].label}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {fmtDateTime(l.createdAt)} · просрочка {l.daysOverdue} дн. ·
                    кому {l.toAddr}
                    {l.ccAddr && `, копия ${l.ccAddr}`}
                    {l.replyToAddr && `, ответ клиента — ${l.replyToAddr}`}
                    {l.mode !== mode &&
                      ` · ${MODE[l.mode].label.toLowerCase()}`}
                  </div>
                  {l.caseClosed && (
                    <div className="text-muted-foreground">
                      Прошлая просрочка — долг тогда был погашен.
                    </div>
                  )}
                  {l.error && <div className="text-red-600">{l.error}</div>}

                  <div className="flex items-center gap-3 pt-0.5">
                    <button
                      onClick={() =>
                        setOpenLetter((id) => (id === l.id ? null : l.id))
                      }
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {openLetter === l.id ? (
                        <EyeOff size={12} />
                      ) : (
                        <Eye size={12} />
                      )}
                      {openLetter === l.id ? 'Скрыть текст' : 'Текст письма'}
                    </button>
                  </div>

                  {openLetter === l.id && (
                    // sandbox без разрешений: скрипты в письме не выполнятся.
                    <iframe
                      title={l.subject}
                      sandbox=""
                      srcDoc={l.html}
                      className="w-full h-96 rounded border bg-white"
                    />
                  )}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Отсрочка: клиент прислал платёжку или договорился о графике — новый крайний срок
 * оплаты. Письма 2–5 считаются заново от него (письмо 2 — за 2 дня до срока),
 * письмо 1 повторно не уходит. Ставить может любой сотрудник — платёжки и звонки
 * приходят в бухгалтерию; кто поставил, видно в истории.
 */
function DeferralSection({
  customerId,
  deferrals,
  onChanged,
}: {
  customerId: string;
  deferrals: DebtorDeferral[];
  onChanged: () => void;
}) {
  const active = deferrals.find((d) => d.active) ?? null;
  const past = deferrals.filter((d) => !d.active);
  const [editing, setEditing] = useState(false);
  const [until, setUntil] = useState(() => addDaysYmd(todayYmd(), 7));
  const [reason, setReason] = useState<DebtDeferralReason>('payment_order');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await receivablesApi.defer(customerId, {
        until,
        reason,
        comment: comment.trim() || undefined,
      });
      setEditing(false);
      setComment('');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!active) return;
    if (
      !window.confirm(
        'Снять отсрочку? Срок снова будет по договору, письма продолжатся со следующего прогона.',
      )
    )
      return;
    setError(null);
    try {
      await receivablesApi.cancelDeferral(active.id);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const tomorrow = addDaysYmd(todayYmd(), 1);
  const maxDate = addDaysYmd(todayYmd(), DEFERRAL_MAX_DAYS);

  return (
    <section className="space-y-2">
      <div className="text-xs text-muted-foreground">ОТСРОЧКА</div>

      {active && !editing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs space-y-1">
          <div className="font-medium text-blue-900 flex items-center gap-1">
            <CalendarClock size={12} /> Новый срок оплаты —{' '}
            {fmtDate(active.until)} · {DEFERRAL_REASON_LABELS[active.reason]}
          </div>
          {active.comment && (
            <div className="whitespace-pre-wrap">{active.comment}</div>
          )}
          <div className="text-muted-foreground">
            Поставил {active.createdBy ?? '—'}, {fmtDateTime(active.createdAt)}
          </div>
          <div className="text-muted-foreground">
            Письма считаются от нового срока: письмо 2 — за 2 дня до него, 3–5 —
            после. Если оплата дойдёт до 1С — кейс закроется сам.
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => {
                setUntil(addDaysYmd(active.until, 7));
                setReason(active.reason);
                setEditing(true);
              }}
              className="text-blue-800 hover:underline"
            >
              Продлить или изменить
            </button>
            <button onClick={cancel} className="text-red-600 hover:underline">
              Снять отсрочку
            </button>
          </div>
        </div>
      )}

      {!active && !editing && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/50 transition-colors"
          >
            <CalendarClock size={13} /> Поставить отсрочку
          </button>
          <span className="text-xs text-muted-foreground">
            Прислал платёжку или договорился о графике — новый срок оплаты,
            письма считаются от него
          </span>
        </div>
      )}

      {editing && (
        <div className="rounded-lg border p-3 space-y-3 text-xs">
          <div className="space-y-1.5">
            <Label className="text-xs">Причина</Label>
            <div className="flex gap-1.5 flex-wrap">
              {(
                Object.keys(DEFERRAL_REASON_LABELS) as DebtDeferralReason[]
              ).map((key) => (
                <button
                  key={key}
                  onClick={() => setReason(key)}
                  className={cn(
                    'px-2.5 py-1 rounded-md border font-medium transition-all',
                    reason === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {DEFERRAL_REASON_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Новый срок оплаты</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                type="date"
                value={until}
                min={tomorrow}
                max={maxDate}
                onChange={(e) => setUntil(e.target.value)}
                className="h-8 rounded-md border bg-transparent px-2 text-sm"
              />
              {[3, 7, 14, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setUntil(addDaysYmd(todayYmd(), n))}
                  className="px-2 py-1 rounded-md border text-muted-foreground hover:bg-muted/50"
                >
                  +{n} дн.
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Комментарий</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              placeholder="Кто звонил и что обещали: «Иванов, 50% до 30.10, остаток до 15.11»"
              className="text-xs md:text-xs"
            />
          </div>

          {error && <div className="text-red-600">{error}</div>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !until}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Сохранить
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="px-3 py-1.5 rounded-md border hover:bg-muted/50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {!editing && error && <div className="text-xs text-red-600">{error}</div>}

      {past.length > 0 && (
        <div className="text-xs">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showHistory ? 'Скрыть' : 'Показать'} прошлые отсрочки (
            {past.length})
          </button>
          {showHistory && (
            <ul className="mt-1.5 space-y-1.5">
              {past.map((d) => (
                <li key={d.id} className="text-muted-foreground">
                  срок {fmtDate(d.until)} · {DEFERRAL_REASON_LABELS[d.reason]}
                  {d.comment && ` — ${d.comment}`}
                  <div className="text-[11px]">
                    поставил {d.createdBy ?? '—'} {fmtDateTime(d.createdAt)}
                    {d.cancelledAt &&
                      ` · снял ${d.cancelledBy ?? '—'} ${fmtDateTime(d.cancelledAt)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Стоп для писем клиенту: спор по сумме или претензия уже направлена. Пока стоп
 * стоит, автоматических писем нет, случай попадает в ежедневный отчёт. Ставят и
 * снимают юристы и админы; история остаётся.
 */
function StopSection({
  customerId,
  stops,
  canAct,
  onChanged,
}: {
  customerId: string;
  stops: DebtorStop[];
  canAct: boolean;
  onChanged: () => void;
}) {
  const active = stops.filter((s) => s.active);
  const past = stops.filter((s) => !s.active);
  const [kind, setKind] = useState<DebtStopKind | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const free = (Object.keys(STOP_KIND_LABELS) as DebtStopKind[]).filter(
    (k) => !active.some((s) => s.kind === k),
  );

  const save = async () => {
    if (!kind) return;
    setSaving(true);
    setError(null);
    try {
      await receivablesApi.stop(customerId, {
        kind,
        comment: comment.trim() || undefined,
      });
      setKind(null);
      setComment('');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (stop: DebtorStop) => {
    if (
      !window.confirm(
        `Снять «${STOP_KIND_LABELS[stop.kind]}»? Письма 3–5 догонят при следующем прогоне.`,
      )
    )
      return;
    setError(null);
    try {
      await receivablesApi.cancelStop(stop.id);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!canAct && active.length === 0 && past.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="text-xs text-muted-foreground">СТОП ДЛЯ ПИСЕМ</div>

      {active.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs space-y-1"
        >
          <div className="font-medium text-red-900 flex items-center gap-1">
            <Ban size={12} /> {STOP_KIND_LABELS[s.kind]} — автоматических писем
            нет
          </div>
          {s.comment && <div className="whitespace-pre-wrap">{s.comment}</div>}
          <div className="text-muted-foreground">
            Поставил {s.createdBy ?? '—'}, {fmtDateTime(s.createdAt)}
          </div>
          {canAct && (
            <button
              onClick={() => cancel(s)}
              className="text-red-700 hover:underline"
            >
              Снять
            </button>
          )}
        </div>
      ))}

      {canAct && !kind && free.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {free.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <Ban size={13} /> {STOP_KIND_LABELS[k]}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">
            писем клиенту не будет, случай — в ежедневном отчёте
          </span>
        </div>
      )}

      {kind && (
        <div className="rounded-lg border p-3 space-y-3 text-xs">
          <div className="font-medium">{STOP_KIND_LABELS[kind]}</div>
          <div className="space-y-1.5">
            <Label className="text-xs">Комментарий</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              placeholder={
                kind === 'dispute'
                  ? 'Что оспаривает клиент: «не согласен с актом TL-00000440»'
                  : 'Когда и кем направлена претензия'
              }
              className="text-xs md:text-xs"
            />
          </div>
          {error && <div className="text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Поставить стоп
            </button>
            <button
              onClick={() => {
                setKind(null);
                setError(null);
              }}
              className="px-3 py-1.5 rounded-md border hover:bg-muted/50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {!kind && error && <div className="text-xs text-red-600">{error}</div>}

      {past.length > 0 && (
        <div className="text-xs">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showHistory ? 'Скрыть' : 'Показать'} снятые стопы ({past.length})
          </button>
          {showHistory && (
            <ul className="mt-1.5 space-y-1.5">
              {past.map((s) => (
                <li key={s.id} className="text-muted-foreground">
                  {STOP_KIND_LABELS[s.kind]}
                  {s.comment && ` — ${s.comment}`}
                  <div className="text-[11px]">
                    поставил {s.createdBy ?? '—'} {fmtDateTime(s.createdAt)}
                    {s.cancelledAt &&
                      ` · снял ${s.cancelledBy ?? '—'} ${fmtDateTime(s.cancelledAt)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** «21.03.2026, сб» — дату праздника удобнее проверять с днём недели. */
const fmtDay = (ymd: string) =>
  `${fmtDate(ymd)}, ${new Date(`${ymd}T00:00:00Z`).toLocaleDateString('ru-RU', {
    weekday: 'short',
    timeZone: 'UTC',
  })}`;

const isWeekend = (ymd: string) => {
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Праздники Узбекистана — нерабочие дни рассылки. Вносят сотрудники: дни Хайита
 * и переносы выходных объявляют каждый год, в коде их нет.
 */
function HolidaysPanel({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<DebtHoliday[] | null>(null);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(
    () =>
      receivablesApi
        .holidays()
        .then(setItems)
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const today = todayYmd();
  const upcoming = (items ?? []).filter((h) => h.date >= today);
  const past = (items ?? []).filter((h) => h.date < today).reverse();

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      await receivablesApi.addHoliday({ date, name: name.trim() || undefined });
      setDate('');
      setName('');
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h: DebtHoliday) => {
    if (!window.confirm(`Убрать праздник ${fmtDay(h.date)}?`)) return;
    setError(null);
    try {
      await receivablesApi.removeHoliday(h.date);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const row = (h: DebtHoliday) => (
    <li
      key={h.date}
      className="flex items-start justify-between gap-3 py-2 text-xs"
    >
      <div>
        <div className="font-medium">
          {fmtDay(h.date)}
          {h.name && ` — ${h.name}`}
        </div>
        <div className="text-muted-foreground">
          внёс {h.createdBy ?? '—'}, {fmtDateTime(h.createdAt)}
        </div>
      </div>
      <button
        onClick={() => remove(h)}
        title="Убрать"
        className="text-muted-foreground hover:text-red-600"
      >
        ✕
      </button>
    </li>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-background shadow-xl p-5 overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-1.5">
              <CalendarDays size={15} /> Праздники
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Нерабочие дни рассылки, кроме субботы и воскресенья. В такой день
              писем нет: письма 1–2 уходят в предыдущий рабочий день (до срока),
              3–5 — в следующий.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <section className="rounded-lg border p-3 space-y-3 text-xs">
          <div className="space-y-1.5">
            <Label className="text-xs">Дата</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-sm"
            />
            {date && isWeekend(date) && (
              <div className="text-amber-700">
                Это суббота или воскресенье — в выходные писем и так нет.
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Название</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="Навруз, Рамазан Хайит, перенос выходного…"
              className="h-8 text-xs"
            />
          </div>
          {error && <div className="text-red-600">{error}</div>}
          <button
            onClick={add}
            disabled={saving || !date}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            Добавить
          </button>
        </section>

        <section className="space-y-1">
          <div className="text-xs text-muted-foreground">ВПЕРЕДИ</div>
          {!items ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Загрузка…
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Праздников не внесено — рассылка идёт по будням.
            </p>
          ) : (
            <ul className="divide-y">{upcoming.map(row)}</ul>
          )}
        </section>

        {past.length > 0 && (
          <section className="text-xs">
            <button
              onClick={() => setShowPast((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showPast ? 'Скрыть' : 'Показать'} прошедшие ({past.length})
            </button>
            {showPast && <ul className="divide-y mt-1">{past.map(row)}</ul>}
          </section>
        )}
      </div>
    </div>
  );
}
