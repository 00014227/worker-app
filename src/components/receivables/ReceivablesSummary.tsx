import { cn } from '@/lib/utils';
import type { DebtMailMode, DebtStage, DebtorRow } from '@/lib/api';
import {
  MAIL_MODE,
  formatMoneyList,
  formatRunTime,
  sumMoney,
} from './receivables-meta';
import { Pill } from './receivables-ui';

/** Режим рассылки и когда следующий прогон — первое, что надо видеть на странице. */
export function ModeBanner({
  mode,
  testRecipient,
  nextRun,
}: {
  mode: DebtMailMode;
  testRecipient: string;
  nextRun: string | null;
}) {
  const modeInfo = MAIL_MODE[mode];
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[14px] border border-[#E2E6EE] bg-card px-4 py-3 text-[13px] leading-relaxed">
      <Pill tone={modeInfo.tone} className="mt-0.5">
        {modeInfo.label}
      </Pill>
      <div className="min-w-0 flex-1">
        <div>
          {modeInfo.hint}
          {mode === 'test' && testRecipient ? ` (${testRecipient})` : ''}.
          Письма создаются и отправляются автоматически каждый рабочий день в
          10:00
          {nextRun ? `, ближайший прогон — ${formatRunTime(nextRun)}` : ''}.
        </div>
        <div className="text-muted-foreground">
          Перед прогоном долги обновляются из 1С. Срок оплаты считается от
          подписи акта клиентом в Didox; не подписал за 10 дней — акт считается
          принятым на 10-й день; акта нет в Didox — от даты акта.
        </div>
      </div>
    </div>
  );
}

export function StatCards({ rows }: { rows: DebtorRow[] }) {
  const overdue = sumMoney(rows.flatMap((row) => row.overdue));
  const debt = sumMoney(rows.flatMap((row) => row.debt));
  const overdueCount = rows.filter((row) => row.overdue.length > 0).length;
  const stats = [
    {
      label: 'Должников',
      value: String(rows.length),
      hint: `с просрочкой — ${overdueCount}`,
    },
    {
      label: 'Просрочено',
      value: formatMoneyList(overdue) || '0',
      hint: 'по сроку оплаты с учётом отсрочек',
    },
    {
      label: 'Весь долг',
      value: formatMoneyList(debt) || '0',
      hint: 'неоплаченные акты из 1С',
    },
  ];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col gap-1 rounded-[14px] border border-[#E2E6EE] bg-card px-[18px] py-4"
        >
          <span className="text-[13px] text-muted-foreground">
            {stat.label}
          </span>
          <span className="text-[24px] font-bold leading-tight">
            {stat.value}
          </span>
          <span className="text-[12px] text-muted-foreground">{stat.hint}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Сводка по этапам: на каком письме клиент сейчас (самый поздний наступивший этап
 * по его актам), сколько клиентов и денег. Клик — фильтр таблицы.
 */
export function StageBuckets({
  rows,
  stages,
  selectedStage,
  onSelect,
}: {
  rows: DebtorRow[];
  stages: DebtStage[];
  selectedStage: number | null;
  onSelect: (stage: number | null) => void;
}) {
  const sortedStages = [...stages].sort(
    (left, right) => left.stage - right.stage,
  );
  const lastStage = sortedStages[sortedStages.length - 1]?.stage;
  const buckets = [
    { stage: 0, title: 'Писем ещё не было', when: 'до первого письма' },
    ...sortedStages,
  ].map((bucket) => {
    const inBucket = rows.filter(
      (row) => (row.stage?.stage ?? 0) === bucket.stage,
    );
    return {
      ...bucket,
      count: inBucket.length,
      overdue: sumMoney(inBucket.flatMap((row) => row.overdue)),
    };
  });

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Где сейчас клиенты</h2>
        <span className="text-[12px] text-muted-foreground">
          После письма {lastStage} — претензия вручную (юрист)
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {buckets.map((bucket) => {
          const isSelected = selectedStage === bucket.stage;
          const isLast = bucket.stage === lastStage && bucket.count > 0;
          return (
            <button
              type="button"
              key={bucket.stage}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : bucket.stage)}
              className={cn(
                'flex flex-col gap-1 rounded-[14px] border bg-card p-3 text-left transition-colors hover:border-primary/40',
                isSelected
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-[#E2E6EE]',
                isLast && !isSelected && 'border-red-200 bg-red-50/60',
              )}
            >
              <span className="flex items-start gap-1.5">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    bucket.stage === 0
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-primary text-primary-foreground',
                  )}
                >
                  {bucket.stage}
                </span>
                <span className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight">
                  {bucket.title}
                </span>
              </span>
              <span className="text-[12px] text-muted-foreground">
                {bucket.when}
              </span>
              <span className="mt-1 text-[22px] font-bold leading-none">
                {bucket.count}
              </span>
              <span className="truncate text-[12px] text-muted-foreground">
                {formatMoneyList(bucket.overdue) || '—'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
