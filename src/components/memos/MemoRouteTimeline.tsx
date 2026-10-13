import { Check, Clock, MessageSquare, RotateCcw, Send, X } from 'lucide-react';
import type { MemoRouteStepView } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DECISION, TASK_STATUS, dueLabel, fmtDateTime, overdueClass } from './memo-meta';

/**
 * Маршрут согласования с историей решений.
 *
 * Одна строка — один проход этапа. После возврата на доработку у этапа
 * появляется вторая попытка: прежнее решение остаётся видимым, и по карточке
 * понятно, что именно просили исправить. Ровно это и просил заказчик —
 * повторная подача идёт с вернувшего шага, а не обнуляет маршрут.
 */
export default function MemoRouteTimeline({ route }: { route: MemoRouteStepView[] }) {
  if (route.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Записка ещё не отправлена — маршрут определится при отправке.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {route.map((step) => {
        const meta = TASK_STATUS[step.status];
        const decision = step.decision;

        return (
          <li
            key={step.taskId}
            className={cn(
              'rounded-lg border px-3 py-2.5',
              step.status === 'pending' && 'border-blue-300 bg-blue-50/40',
            )}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-semibold">
                {step.stepNo}
              </span>
              <span className="text-xs font-medium">{step.roleName}</span>

              {step.attempt > 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                  попытка {step.attempt}
                </span>
              )}
              {!step.isMandatory && (
                <span className="text-[10px] text-muted-foreground">необязательный</span>
              )}

              <span
                className={cn(
                  'ml-auto text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0',
                  meta.chip,
                )}
              >
                {meta.label}
              </span>
            </div>

            {/* Ждёт решения — показываем срок: именно по нему напоминает бот. */}
            {step.status === 'pending' && step.dueAt && (
              <div className={cn('mt-1.5 text-[11px] flex items-center gap-1', overdueClass(step.dueAt))}>
                <Clock size={11} /> {dueLabel(step.dueAt)} · срок {fmtDateTime(step.dueAt)}
              </div>
            )}

            {decision && (
              <div className="mt-2 pl-7 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  {decision.decision === 'approve' ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : decision.decision === 'reject' ? (
                    <X size={12} className="text-red-600" />
                  ) : (
                    <RotateCcw size={12} className="text-amber-600" />
                  )}
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded border font-medium',
                      DECISION[decision.decision].chip,
                    )}
                  >
                    {DECISION[decision.decision].label}
                  </span>
                  <span className="font-medium">{decision.byName}</span>
                  <span className="text-muted-foreground">{fmtDateTime(decision.at)}</span>
                  {/* Откуда решение: с телефона или из кабинета — в споре важно. */}
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    {decision.source === 'telegram' ? (
                      <>
                        <Send size={10} /> из Telegram
                      </>
                    ) : (
                      'из кабинета'
                    )}
                  </span>
                </div>
                {decision.comment && (
                  <div className="text-xs bg-muted/50 rounded px-2 py-1.5 flex gap-1.5">
                    <MessageSquare size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="break-words">{decision.comment}</span>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
