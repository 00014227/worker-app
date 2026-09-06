import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Clock,
  FileDiff,
  Info,
  Loader2,
  Printer,
  Search,
  TriangleAlert,
} from 'lucide-react';
import {
  contractDiffApi,
  ContractDiff,
  ContractDiffRow,
  DiffItem,
  DiffMode,
  DiffRisk,
} from '@/lib/api';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import UploadZone from '@/components/contract-diff/UploadZone';
import ChangeCard from '@/components/contract-diff/ChangeCard';
import DocumentView from '@/components/contract-diff/DocumentView';
import { KIND, RISK, riskOrder } from '@/components/contract-diff/diff-meta';

/** Шаги разбора. Договор сверяется до минуты — без них экран выглядит зависшим. */
const STEPS = ['Читаем файлы', 'Сверяем пункты', 'Оцениваем правки'];

export default function ContractDiffPage() {
  const [mode, setMode] = useState<DiffMode>('ours');
  const [left, setLeft] = useState<File | null>(null);
  const [right, setRight] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ContractDiff | null>(null);
  const [history, setHistory] = useState<ContractDiffRow[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const [riskFilter, setRiskFilter] = useState<DiffRisk | 'all'>('all');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Как читать результат: договор целиком или одни правки. */
  const [view, setView] = useState<'document' | 'changes'>('document');
  /** Какие правки раскрыты в теле документа. */
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const rowsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const loadHistory = useCallback(() => {
    contractDiffApi
      .history()
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    contractDiffApi
      .status()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
    loadHistory();
  }, [loadHistory]);

  const run = async () => {
    if (!left || !right || busy) return;
    setBusy(true);
    setError(null);
    setStep(0);
    // Шаги двигаем по времени: сервер отдаёт результат целиком, а показать ход
    // работы всё равно нужно — иначе минута ожидания читается как зависание.
    const t1 = setTimeout(() => setStep(1), 1200);
    const t2 = setTimeout(() => setStep(2), 4000);
    try {
      const res = await contractDiffApi.compare(left, right, mode);
      setReport(res);
      setActiveId(res.items[0]?.id ?? null);
      loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await contractDiffApi.byId(id);
      setReport(res);
      setActiveId(res.items[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Правки: сначала опасные, дальше по документу. */
  const items = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    return report.items
      .filter((i) => riskFilter === 'all' || i.risk === riskFilter)
      .filter(
        (i) =>
          !q ||
          `${i.clauseNumber ?? ''} ${i.summary ?? ''} ${i.before ?? ''} ${i.after ?? ''}`
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => riskOrder(a.risk) - riskOrder(b.risk));
  }, [report, riskFilter, query]);

  const goTo = useCallback((id: string) => {
    setActiveId(id);
    // Переход из списка сразу раскрывает разбор: иначе логист попадает на
    // подсвеченный пункт и вынужден делать второй клик, чтобы понять, что не так.
    setOpenIds((prev) => new Set(prev).add(id));
    rowsRef.current[id]?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }, []);

  // j/k — следующая и предыдущая правка. Список из тридцати позиций мышкой
  // перебирать мучительно, а юрист идёт по нему подряд.
  useEffect(() => {
    if (!report) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const idx = items.findIndex((i) => i.id === activeId);
      const next = e.key === 'j' ? idx + 1 : idx - 1;
      if (next >= 0 && next < items.length) goTo(items[next].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [report, items, activeId, goTo]);

  const swap = () => {
    setLeft(right);
    setRight(left);
  };

  const labels =
    mode === 'ours'
      ? { left: 'Наш шаблон', right: 'Версия контрагента' }
      : { left: 'Версия 1', right: 'Версия 2' };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileDiff size={18} /> Сверка договоров
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Что изменилось между двумя версиями и чем это грозит
          </p>
        </div>
        {report && (
          <button
            onClick={() => window.print()}
            className="print:hidden text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border"
          >
            <Printer size={13} /> Печать
          </button>
        )}
      </div>

      {enabled === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          Толкование правок не настроено: не задан ключ доступа к модели.
          Отличия система найдёт и покажет, но оценки риска и рекомендаций не
          будет.
        </div>
      )}

      {/* Оговорка на виду: главный риск раздела — юрист, принявший отчёт за заключение. */}
      <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-start gap-2 print:hidden">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>
          Список отличий полон — он считается механически, пункт за пунктом.{' '}
          <b>Оценка риска и рекомендации — суждение модели</b>, их проверяйте.
          Из PDF текст извлекается с потерями: пара версий в docx даст более
          точную сверку.
        </span>
      </div>

      {/* ── Загрузка ── */}
      <div className="rounded-xl border p-4 print:hidden">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="inline-flex rounded-lg border overflow-hidden text-xs">
            {(['ours', 'neutral'] as DiffMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted/50',
                )}
              >
                {m === 'ours' ? 'Наш шаблон и правки' : 'Две версии'}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {mode === 'ours'
              ? 'Рекомендации с позиции Транс-Азии'
              : 'Нейтральная оценка для обеих сторон'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-end">
          <UploadZone
            label={labels.left}
            hint="исходная версия"
            file={left}
            onPick={setLeft}
            disabled={busy}
          />
          <button
            onClick={swap}
            disabled={busy}
            title="Поменять файлы местами — порядок задаёт, с чьей стороны оценка"
            className="mb-6 p-2 rounded-lg border hover:bg-muted/50 disabled:opacity-40 self-center"
          >
            <ArrowLeftRight size={14} />
          </button>
          <UploadZone
            label={labels.right}
            hint="что сравниваем"
            file={right}
            onPick={setRight}
            disabled={busy}
          />
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={run}
            disabled={!left || !right || busy}
            className="px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileDiff size={14} />
            )}
            Сверить
          </button>
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(i === step && 'text-foreground font-medium')}
                >
                  {i < step ? '✓ ' : ''}
                  {s}
                  {i < STEPS.length - 1 && (
                    <span className="mx-1.5 opacity-40">→</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* ── Сводка ── */}
          <div className="rounded-xl border px-5 py-3 flex items-center gap-5 flex-wrap">
            <div>
              <div className="text-2xl font-bold leading-none">
                {report.changeCount}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                правок
              </div>
            </div>
            <div>
              <div
                className={cn(
                  'text-2xl font-bold leading-none',
                  report.highRiskCount > 0
                    ? 'text-red-600'
                    : 'text-muted-foreground',
                )}
              >
                {report.highRiskCount}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                с высоким риском
              </div>
            </div>
            <div className="text-xs text-muted-foreground min-w-0">
              <div className="truncate">
                <b className="text-foreground">{report.leftName}</b> →{' '}
                {report.rightName}
              </div>
              <div className="mt-0.5">
                пунктов: {report.leftClauseCount} → {report.rightClauseCount} ·{' '}
                {report.mode === 'ours' ? 'с нашей стороны' : 'нейтрально'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[300px_1fr] print:block">
            {/* ── Список правок ── */}
            <div className="space-y-2 print:hidden">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="pl-8 h-8 text-xs"
                  placeholder="Поиск по правкам…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-1 text-[11px]">
                {(['all', 'high', 'medium', 'low'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRiskFilter(r)}
                    className={cn(
                      'px-2 py-1 rounded border transition-colors',
                      riskFilter === r
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    {r === 'all' ? 'Все' : RISK[r].label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-muted-foreground px-1">
                {items.length} из {report.changeCount} · клавиши j/k
              </div>

              <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
                {items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => goTo(it.id)}
                    className={cn(
                      'w-full text-left rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors',
                      activeId === it.id && 'ring-1 ring-primary bg-primary/5',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          it.risk ? RISK[it.risk].dot : 'bg-slate-300',
                        )}
                      />
                      <span className="text-xs font-medium">
                        п. {it.clauseNumber ?? '—'}
                      </span>
                      {it.kind !== 'same' && (
                        <span className="text-[10px] text-muted-foreground">
                          {KIND[it.kind].label}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {it.summary ?? it.after ?? it.before}
                    </div>
                  </button>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Под фильтр ничего не попало
                  </p>
                )}
              </div>
            </div>

            {/* ── Документ целиком, правки подсвечены по месту ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 print:hidden">
                <div className="inline-flex rounded-lg border overflow-hidden text-xs">
                  {(
                    [
                      ['document', 'Документ'],
                      ['changes', 'Только правки'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={cn(
                        'px-3 py-1.5 transition-colors',
                        view === v
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted/50',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {view === 'document'
                    ? 'договор целиком, правка раскрывается по клику'
                    : 'только изменённые пункты, подряд'}
                </span>
              </div>

              {view === 'document' ? (
                <DocumentView
                  report={report}
                  activeId={activeId}
                  openIds={openIds}
                  onToggle={(id) =>
                    setOpenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  rowsRef={rowsRef}
                />
              ) : (
                items.map((it) => (
                  <div
                    key={it.id}
                    ref={(el) => {
                      rowsRef.current[it.id] = el;
                    }}
                    className={cn(
                      'rounded-lg transition-shadow',
                      activeId === it.id && 'ring-2 ring-primary/30',
                    )}
                  >
                    <ChangeCard item={it} />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {!report && history.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground px-1">
            Последние сверки
          </div>
          {history.map((h) => (
            <button
              key={h.id}
              onClick={() => open(h.id)}
              className="w-full text-left rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className="text-xs font-medium truncate">
                {h.leftName} → {h.rightName}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Clock size={10} />
                {new Date(h.createdAt).toLocaleString('ru-RU')}
                <span>· правок {h.changeCount}</span>
                {h.highRiskCount > 0 && (
                  <span className="text-red-600">
                    · рискованных {h.highRiskCount}
                  </span>
                )}
                {h.employee && <span>· {h.employee.name}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Тип правки нужен карточке и виду документа — переэкспортируем из одного места. */
export type { DiffItem };
