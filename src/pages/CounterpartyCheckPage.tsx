import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Scale,
  Search,
  Loader2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Clock,
  Info,
} from 'lucide-react';
import {
  legalCheckApi,
  CounterpartyCheck,
  CheckHistoryRow,
  RiskLevel,
} from '@/lib/api';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const RISK: Record<RiskLevel, { label: string; cls: string }> = {
  low: {
    label: 'Ничего настораживающего',
    cls: 'bg-green-50 text-green-700 border-green-200',
  },
  medium: {
    label: 'Есть спорные моменты',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  high: { label: 'Высокий риск', cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: {
    label: 'Данных мало',
    cls: 'bg-muted text-muted-foreground border-border',
  },
};

/**
 * Разбивает отчёт на куски по привязкам к источникам, чтобы поставить номер
 * ссылки прямо у подтверждённого им фрагмента. Юристу важно видеть, ЧТО именно
 * подтверждено: сводный список ссылок внизу этого не говорит.
 */
function withCitations(check: CounterpartyCheck) {
  const anns = (check.annotations ?? []).filter((a) => a.end > a.start);
  if (anns.length === 0)
    return [{ text: check.report, sources: [] as number[] }];

  const parts: { text: string; sources: number[] }[] = [];
  let cursor = 0;
  for (const a of anns) {
    const start = Math.max(cursor, Math.min(a.start, check.report.length));
    const end = Math.max(start, Math.min(a.end, check.report.length));
    if (start > cursor)
      parts.push({ text: check.report.slice(cursor, start), sources: [] });
    if (end > start)
      parts.push({ text: check.report.slice(start, end), sources: a.sources });
    cursor = Math.max(cursor, end);
  }
  if (cursor < check.report.length) {
    parts.push({ text: check.report.slice(cursor), sources: [] });
  }
  return parts;
}

/** Пауза между опросами готовности. */
const POLL_MS = 2500;

export default function CounterpartyCheckPage() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<CounterpartyCheck | null>(null);
  const [history, setHistory] = useState<CheckHistoryRow[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  /** Какую проверку ждём: ответы прежней не должны затирать новую. */
  const pollFor = useRef<string | null>(null);
  /** Проверка ещё идёт — отчёта нет, показывать его пустым нельзя. */
  const pending = check?.status === 'processing';
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const loadHistory = () => {
    legalCheckApi
      .history()
      .then(setHistory)
      .catch(() => undefined);
  };

  useEffect(() => {
    legalCheckApi
      .status()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
    loadHistory();
  }, []);

  /**
   * Ждём готовности проверки, опрашивая сервер.
   *
   * Поиск по источникам занимает около минуты, а прокси рвёт запрос на 26-й
   * секунде. Поэтому сервер отвечает сразу заготовкой со `status: 'processing'`,
   * и без опроса юрист видел бы пустой отчёт вместо идущей работы.
   */
  const awaitReady = useCallback(async (id: string) => {
    for (;;) {
      const res = await legalCheckApi.byId(id);
      if (pollFor.current !== id) return null;
      setCheck(res);
      if (res.status === 'failed') throw new Error(res.error || 'Проверка не удалась');
      if (res.status !== 'processing') return res;
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }, []);

  const run = async (force = false) => {
    const q = force ? (check?.rawQuery ?? query) : query;
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    setCheck(null);
    try {
      const started = await legalCheckApi.check(q.trim(), force);
      pollFor.current = started.id;
      setCheck(started);
      setQuery(started.rawQuery);
      if (started.status === 'processing') await awaitReady(started.id);
      loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    setBusy(true);
    setError(null);
    pollFor.current = id;
    try {
      const first = await legalCheckApi.byId(id);
      setCheck(first);
      setQuery(first.rawQuery);
      // Из списка можно открыть и ещё не досчитанную проверку — ждём так же.
      if (first.status === 'processing') await awaitReady(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Пока в списке есть идущая проверка, обновляем его сами: юрист мог обновить
  // вкладку посреди поиска, и строка иначе навсегда замрёт на «идёт».
  useEffect(() => {
    if (!history.some((h) => h.status === 'processing')) return;
    const timer = setInterval(loadHistory, POLL_MS * 2);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const parts = useMemo(() => (check ? withCitations(check) : []), [check]);
  /** Источник по его номеру — сноскам нужен адрес, а не только цифра. */
  const byIndex = useMemo(
    () => new Map((check?.sources ?? []).map((s) => [s.index, s])),
    [check],
  );
  const risk = check?.riskLevel ? RISK[check.riskLevel] : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Scale size={18} /> Проверка контрагентов
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Поиск по открытым источникам в интернете с обязательными ссылками
        </p>
      </div>

      {enabled === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Раздел не настроен: не задан ключ доступа к Gemini. Обратитесь к
          администратору.
        </div>
      )}

      {/* Оговорка на виду, а не мелким шрифтом внизу: главный риск этого раздела —
          юрист, который примет отчёт за юридическое заключение. */}
      <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>
          Это подспорье для проверки, а не юридическое заключение. Поиск находит
          только то, что опубликовано и проиндексировано: закрытые реестры и
          свежие судебные акты сюда могут не попасть.{' '}
          <b>Отсутствие плохих новостей не означает, что контрагент надёжен.</b>
          Проверяйте по ссылкам.
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xl">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-8 h-9"
            placeholder="Название компании или ИНН…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run(false)}
          />
        </div>
        <button
          onClick={() => run(false)}
          disabled={!query.trim() || busy || enabled === false}
          className="px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          Проверить
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          {(pending || (busy && !check)) && (
            <CheckProgress query={check?.rawQuery ?? query} />
          )}

          {check && !pending && (
            <div className="rounded-xl border">
              <div className="flex items-start justify-between gap-3 px-5 py-3 border-b">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {check.rawQuery}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Clock size={11} />
                    {new Date(check.createdAt).toLocaleString('ru-RU')}
                    {check.fromCache && <span>· сохранённый отчёт</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {risk && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded border text-xs font-medium',
                        risk.cls,
                      )}
                    >
                      {risk.label}
                    </span>
                  )}
                  <button
                    onClick={() => run(true)}
                    disabled={busy}
                    title="Выполнить поиск заново"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <RefreshCw
                      size={14}
                      className={busy ? 'animate-spin' : ''}
                    />
                  </button>
                </div>
              </div>

              {/* Сноски ведут прямо на источник. Раньше рядом с текстом стояли
                  голые номера, и чтобы понять, откуда взято утверждение, юрист
                  отматывал к списку внизу и искал строку по номеру. */}
              <div className="px-5 py-4 text-sm whitespace-pre-wrap leading-relaxed">
                {parts.map((p, i) =>
                  p.sources.length > 0 ? (
                    <span
                      key={i}
                      className="border-b border-dotted border-primary/50"
                    >
                      {p.text}
                      <span className="whitespace-nowrap">
                        {p.sources.map((n) => {
                          const src = byIndex.get(n);
                          if (!src) return null;
                          return (
                            <a
                              key={n}
                              href={src.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              title={`${src.title}\n${hostOf(src.url)}`}
                              className="ml-0.5 align-super text-[10px] font-medium text-primary hover:underline"
                            >
                              [{n}]
                            </a>
                          );
                        })}
                        {/* Домен первого источника — чтобы «откуда это» читалось
                            без наведения: суду ссылаются на реестр, а не на форум. */}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {hostOf(byIndex.get(p.sources[0])?.url ?? '')}
                        </span>
                      </span>
                    </span>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )}
              </div>

              <div className="px-5 py-3 border-t">
                <button
                  onClick={() => setSourcesOpen((v) => !v)}
                  className="text-xs font-medium mb-1.5 hover:underline"
                >
                  {sourcesOpen ? 'Скрыть' : 'Показать'} полный список источников
                  ({check.sources.length})
                </button>
                {check.sources.length === 0 ? (
                  // Отчёт без ссылок проверить нельзя — говорим прямо.
                  <p className="text-xs text-amber-700 flex items-start gap-1">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    Модель не привела ни одного источника. Такому отчёту
                    доверять нельзя — проверьте контрагента вручную.
                  </p>
                ) : sourcesOpen ? (
                  <ol className="space-y-1">
                    {check.sources.map((s) => (
                      <li key={s.index} className="text-xs flex gap-1.5">
                        <span className="text-muted-foreground shrink-0">
                          {s.index}.
                        </span>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-primary hover:underline inline-flex items-start gap-1 min-w-0"
                        >
                          <span className="truncate">{s.title}</span>
                          <ExternalLink size={10} className="mt-0.5 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>

              {/* Показ подсказок поиска требуют условия использования Google. */}
              {check.searchSuggestions && (
                <div
                  className="px-5 py-3 border-t"
                  dangerouslySetInnerHTML={{ __html: check.searchSuggestions }}
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground px-1">
            Последние проверки
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">Пока пусто</p>
          ) : (
            history.map((h) => (
              <button
                key={h.id}
                onClick={() => open(h.id)}
                className={cn(
                  'w-full text-left rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors',
                  check?.id === h.id && 'ring-1 ring-primary',
                )}
              >
                <div className="text-xs font-medium truncate">{h.rawQuery}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                  {/* Идущая проверка без отметки выглядит как пустая: ни риска,
                      ни отчёта — будто ничего не нашли. */}
                  {h.status === 'processing' ? (
                    <span className="text-primary flex items-center gap-1">
                      <Loader2 size={9} className="animate-spin" /> идёт
                    </span>
                  ) : h.status === 'failed' ? (
                    <span className="text-red-600">не удалась</span>
                  ) : (
                    h.riskLevel && (
                      <span
                        className={cn(
                          'px-1 rounded border',
                          RISK[h.riskLevel].cls,
                        )}
                      >
                        {h.riskLevel}
                      </span>
                    )
                  )}
                  {new Date(h.createdAt).toLocaleDateString('ru-RU')}
                  {h.employee && ` · ${h.employee.name}`}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Экран ожидания проверки.
 *
 * Проверка идёт в фоне около минуты: модель ищет, открывает найденные страницы
 * и сводит их в отчёт. Без явного «работаем» юрист видит пустоту и решает, что
 * ничего не нашлось, — ровно так это и выглядело, когда прокси рвал запрос.
 */
function CheckProgress({ query }: { query: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <Loader2 size={16} className="animate-spin text-primary shrink-0" />
        <span className="text-sm font-semibold">Ищем в открытых источниках</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {elapsed < 60
            ? `${elapsed} с`
            : `${Math.floor(elapsed / 60)} мин ${String(elapsed % 60).padStart(2, '0')} с`}
        </span>
        {query && (
          <span className="text-xs text-muted-foreground truncate min-w-0">
            · {query}
          </span>
        )}
      </div>

      {/* Полосу процентов не рисуем: сколько источников модель откроет, заранее
          неизвестно, и выдуманный процент хуже честного секундомера. */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-1/3 bg-primary/70 animate-pulse rounded-full" />
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Модель ищет в интернете, открывает найденные страницы и сводит их в
        отчёт со ссылками — обычно около минуты. Страницу можно закрыть:
        проверка досчитается и появится в списке справа.
      </p>

      <div className="space-y-2 pt-1">
        {[92, 78, 85, 60].map((w, i) => (
          <div
            key={i}
            className="h-2 rounded bg-muted animate-pulse"
            style={{ width: `${w}%`, animationDelay: `${i * 140}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Домен источника: «egov.uz» вместо длинного адреса со всеми параметрами. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
