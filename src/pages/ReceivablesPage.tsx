import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Play, RefreshCw, Search } from 'lucide-react';
import {
  receivablesApi,
  type DebtStopReason,
  type DebtorRow,
  type DunningRunResult,
  type DunningRunState,
} from '../lib/api';
import { getUser } from '../lib/auth';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  RUN_DESTINATION,
  STOP_REASON_LABELS,
} from '@/components/receivables/receivables-meta';
import { Notice, buttonClass } from '@/components/receivables/receivables-ui';
import {
  ModeBanner,
  StageBuckets,
  StatCards,
} from '@/components/receivables/ReceivablesSummary';
import { DebtorsTable } from '@/components/receivables/DebtorsTable';
import { DebtorPanel } from '@/components/receivables/DebtorPanel';
import { HolidaysPanel } from '@/components/receivables/HolidaysPanel';
import { useManualRun } from '@/components/receivables/useManualRun';

type ReceivablesList = Awaited<ReturnType<typeof receivablesApi.list>>;

/** Итог прогона одной строкой: сколько писем, почему какие-то не ушли. */
function describeRun(result: DunningRunResult): string {
  const parts = [`Создано писем: ${result.created}`];
  const reasons = new Map<DebtStopReason, number>();
  for (const stopped of result.stopped) {
    reasons.set(stopped.reason, (reasons.get(stopped.reason) ?? 0) + 1);
  }
  if (reasons.size) {
    const reasonList = [...reasons]
      .map(([reason, count]) => `${STOP_REASON_LABELS[reason]} — ${count}`)
      .join(', ');
    parts.push(`не отправлено: ${reasonList}`);
  }
  if (result.closed) parts.push(`закрыто (долг погашен): ${result.closed}`);
  if (result.sent) parts.push(`отправлено: ${result.sent}`);
  if (result.failed)
    parts.push(`не ушло: ${result.failed} — причина в карточке клиента`);
  return parts.join(' · ');
}

/** Итог прогона по кнопке — для плашки над таблицей. */
function runNotice(
  finished: Extract<DunningRunState, { status: 'done' | 'failed' }>,
) {
  if (finished.status === 'failed') {
    return { isOk: false, text: `Прогон не удался: ${finished.error}` };
  }
  return {
    isOk: finished.result.failed === 0,
    text: describeRun(finished.result),
  };
}

const chipClass = (isActive: boolean) =>
  cn(
    'h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors',
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'bg-[#E8ECF3] text-slate-700 hover:bg-[#DDE3EE]',
  );

export default function ReceivablesPage() {
  const user = getUser();
  // Бэкенд всё равно проверит права — здесь просто не показываем лишние кнопки.
  const canAct = !!(user?.isAdmin || user?.isLawyer);

  const [data, setData] = useState<ReceivablesList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyStops, setOnlyStops] = useState(false);
  const [onlyDeferred, setOnlyDeferred] = useState(false);
  /** Этап из сводки; 0 — «писем ещё не было», null — все. */
  const [stageFilter, setStageFilter] = useState<number | null>(null);
  const [selected, setSelected] = useState<DebtorRow | null>(null);
  const [showHolidays, setShowHolidays] = useState(false);

  // Состояние меняем только в колбэках запроса — эффект при открытии
  // страницы не должен синхронно дёргать setState (лишний рендер).
  const fetchList = useCallback(
    () =>
      receivablesApi
        .list()
        .then((list) => {
          setData(list);
          setError(null);
        })
        .catch((loadError: Error) => setError(loadError.message))
        .finally(() => setIsLoading(false)),
    [],
  );
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const reload = () => {
    setIsLoading(true);
    fetchList();
  };

  // Прогон идёт на сервере в фоне; закончился — обновляем таблицу.
  const manualRun = useManualRun({ canRun: canAct, onFinished: reload });
  const runResult = manualRun.finished ? runNotice(manualRun.finished) : null;

  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (onlyStops && row.stops.length === 0) return false;
      if (onlyDeferred && !row.deferral) return false;
      if (stageFilter !== null && (row.stage?.stage ?? 0) !== stageFilter)
        return false;
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        (row.inn ?? '').includes(query)
      );
    });
  }, [allRows, search, onlyStops, onlyDeferred, stageFilter]);

  const stoppedCount = allRows.filter((row) => row.stops.length).length;
  const deferredCount = allRows.filter((row) => row.deferral).length;
  const hasFilters =
    !!search || onlyStops || onlyDeferred || stageFilter !== null;

  const resetFilters = () => {
    setSearch('');
    setOnlyStops(false);
    setOnlyDeferred(false);
    setStageFilter(null);
  };

  const runNow = () => {
    if (!data) return;
    const isConfirmed = window.confirm(
      `Прогнать рассылку сейчас, не дожидаясь расписания?\n\nСначала подтянем свежие долги из 1С и статусы Didox — около минуты. Новые письма ${RUN_DESTINATION[data.mode]}.`,
    );
    if (isConfirmed) manualRun.start();
  };

  const emptyText = isLoading
    ? 'Загрузка…'
    : allRows.length
      ? 'Никого не нашли'
      : 'Должников нет. Долги появятся после выгрузки из 1С.';

  return (
    <div className="mx-auto max-w-[1400px] space-y-[18px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.01em]">
            Дебиторка
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Письма должникам по этапам и всё, что их останавливает: отсрочки,
            споры, претензии.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reload}
            aria-label="Обновить"
            title="Обновить"
            className={cn(buttonClass.outline, 'w-9 justify-center px-0')}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setShowHolidays(true)}
            className={buttonClass.outline}
          >
            <CalendarDays size={15} /> Праздники
          </button>
          {canAct && (
            <button
              type="button"
              onClick={runNow}
              disabled={manualRun.isRunning || !data}
              className={buttonClass.primary}
            >
              {manualRun.isRunning ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Play size={15} />
              )}
              {manualRun.isRunning ? 'Прогон идёт…' : 'Прогнать сейчас'}
            </button>
          )}
        </div>
      </header>

      {data && (
        <ModeBanner
          mode={data.mode}
          testRecipient={data.testRecipient}
          nextRun={data.nextRun}
        />
      )}

      {data && !data.lettersReady && (
        <Notice tone="amber">
          <span className="font-semibold">Подпись писем не заполнена:</span> нет
          контакта (DEBT_CONTACT_*) или организация не настроена. Клиентам
          (боевой режим) письма не уйдут; тестовые и режим проверки работают.
        </Notice>
      )}
      {manualRun.isRunning && (
        <Notice tone="blue">
          Прогон идёт: 1С, Didox, затем письма — около минуты. Страницу можно
          закрыть: прогон дойдёт до конца на сервере.
        </Notice>
      )}
      {runResult && (
        <Notice tone={runResult.isOk ? 'green' : 'red'}>
          {runResult.text}
        </Notice>
      )}
      {manualRun.error && <Notice tone="red">{manualRun.error}</Notice>}
      {error && <Notice tone="red">{error}</Notice>}

      {data && allRows.length > 0 && (
        <>
          <StatCards rows={allRows} />
          <StageBuckets
            rows={allRows}
            stages={data.stages}
            selectedStage={stageFilter}
            onSelect={setStageFilter}
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 max-w-sm flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Поиск по названию или ИНН"
            className="h-9 rounded-[9px] bg-card pl-9 text-[13px]"
            placeholder="Название или ИНН…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button
          type="button"
          aria-pressed={onlyStops}
          onClick={() => setOnlyStops((isOn) => !isOn)}
          className={chipClass(onlyStops)}
        >
          Со стопом{stoppedCount ? ` · ${stoppedCount}` : ''}
        </button>
        <button
          type="button"
          aria-pressed={onlyDeferred}
          onClick={() => setOnlyDeferred((isOn) => !isOn)}
          className={chipClass(onlyDeferred)}
        >
          С отсрочкой{deferredCount ? ` · ${deferredCount}` : ''}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className={cn(buttonClass.link, 'px-2')}
          >
            Сбросить
          </button>
        )}
        <span className="ml-auto text-[13px] text-muted-foreground">
          {hasFilters
            ? `Показано ${rows.length} из ${allRows.length}`
            : `Клиентов: ${allRows.length}`}
        </span>
      </div>

      <DebtorsTable rows={rows} emptyText={emptyText} onOpen={setSelected} />

      {showHolidays && (
        <HolidaysPanel
          onClose={() => setShowHolidays(false)}
          onChanged={reload}
        />
      )}

      {selected && data && (
        <DebtorPanel
          row={selected}
          mode={data.mode}
          stages={data.stages}
          canAct={canAct}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
