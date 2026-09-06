import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { ContractDiff } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Экран ожидания сверки.
 *
 * Нужен потому, что сверка идёт в фоне: сервер отвечает на загрузку сразу, а
 * распознавание сканов занимает минуты. Без явного «работаем» юрист видел
 * пустой отчёт и решал, что система ничего не нашла — так и было заявлено:
 * «впечатление, что ничего не выдало».
 *
 * Поэтому здесь всё, что отличает работу от зависания: какой шаг идёт, сколько
 * страниц пройдено, сколько времени прошло и чего ждать дальше.
 */
export default function ComparisonProgress({ report }: { report: ContractDiff }) {
  const [elapsed, setElapsed] = useState(0);

  // Секундомер. На третьей минуте распознавания это единственное, что отвечает
  // на вопрос «оно вообще живое?».
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const stage = report.stage ?? 'reading';
  const done = report.progressDone ?? 0;
  const total = report.progressTotal ?? 0;

  const steps = [
    { key: 'reading', label: 'Читаем файлы', note: null as string | null },
    {
      key: 'ocr',
      label: 'Распознаём страницы',
      note: total ? `${done} из ${total}` : null,
    },
    { key: 'aligning', label: 'Сопоставляем пункты', note: null },
    {
      key: 'interpreting',
      label: 'Оцениваем правки',
      note: stage === 'interpreting' && total ? `${done} из ${total}` : null,
    },
  ];
  const current = Math.max(
    steps.findIndex((s) => s.key === stage),
    0,
  );

  return (
    <div className="rounded-xl border p-5 space-y-4 print:hidden">
      <div className="flex items-center gap-2.5 flex-wrap">
        <Loader2 size={16} className="animate-spin text-primary shrink-0" />
        <span className="text-sm font-semibold">Сверяем документы</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatElapsed(elapsed)}
        </span>
        <span className="text-xs text-muted-foreground truncate min-w-0">
          {report.leftName} ↔ {report.rightName}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${percent(stage, done, total)}%` }}
        />
      </div>

      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className={cn(
              'flex items-center gap-2 text-xs',
              i < current && 'text-muted-foreground',
              i === current && 'font-medium',
              i > current && 'text-muted-foreground/50',
            )}
          >
            <span className="w-4 shrink-0 flex justify-center">
              {i < current ? (
                <Check size={12} className="text-emerald-600" />
              ) : i === current ? (
                <Loader2 size={12} className="animate-spin text-primary" />
              ) : (
                <span className="size-1.5 rounded-full bg-current opacity-50" />
              )}
            </span>
            {step.label}
            {step.note && (
              <span className="text-muted-foreground tabular-nums">
                · {step.note}
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* Обещание конкретного срока: «скоро» на второй минуте не успокаивает. */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {stage === 'ocr'
          ? 'В файле нет текстового слоя — читаем страницы распознаванием. На документ в десять страниц уходит одна-две минуты.'
          : 'Обычно это занимает несколько секунд; сканы распознаются дольше.'}{' '}
        Страницу можно закрыть: сверка досчитается на сервере и появится в
        списке ниже.
      </p>

      {/* Намёк на то, что появится: две колонки с документами. */}
      <div className="grid grid-cols-2 gap-px bg-border rounded-lg overflow-hidden">
        {[0, 1].map((col) => (
          <div key={col} className="bg-background p-3 space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-2 rounded bg-muted animate-pulse"
                style={{
                  width: `${[92, 78, 60][row]}%`,
                  animationDelay: `${(col * 3 + row) * 120}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Доля выполненного. Стадиям отведены полосы, внутри полосы — счётчик страниц:
 * так полоска движется и внутри долгого распознавания, а не стоит на месте.
 */
function percent(stage: string, done: number, total: number): number {
  const share = total > 0 ? Math.min(done / total, 1) : 0;
  if (stage === 'ocr') return 10 + share * 50;
  if (stage === 'aligning') return 65;
  if (stage === 'interpreting') return 70 + share * 30;
  return 6;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} с`;
  return `${Math.floor(seconds / 60)} мин ${String(seconds % 60).padStart(2, '0')} с`;
}
