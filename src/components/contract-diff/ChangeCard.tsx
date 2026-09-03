import { useState } from 'react';
import { Check, Copy, Lightbulb, TriangleAlert } from 'lucide-react';
import { DiffItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ADVICE, KIND, RISK, SIDE } from './diff-meta';
import ClauseText from './ClauseText';

/**
 * Разбор одной правки: было / стало, толкование, риск, рекомендация.
 *
 * Толкование может отсутствовать — модель бывает недоступна. Правку это не
 * отменяет: её нашла механика, и юрист увидит её в любом случае. Поэтому карточка
 * рассчитана на пустые поля и честно говорит, что оценки нет.
 */
export default function ChangeCard({ item }: { item: DiffItem }) {
  const [copied, setCopied] = useState(false);
  const kind = item.kind === 'same' ? null : KIND[item.kind];
  const risk = item.risk ? RISK[item.risk] : null;
  const advice = item.advice ? ADVICE[item.advice] : null;

  /** Готовая формулировка для письма контрагенту — иначе юрист набирает её руками. */
  const copyForLetter = () => {
    const lines = [
      `Пункт ${item.clauseNumber ?? '—'}${item.summary ? `: ${item.summary}` : ''}`,
      item.before ? `\nБыло: ${item.before}` : '',
      item.after ? `\nСтало: ${item.after}` : '',
      item.adviceText ? `\nНаша позиция: ${item.adviceText}` : '',
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('')).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  };

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-start gap-2 flex-wrap px-4 py-2.5 border-b">
        <span className="text-sm font-semibold">
          Пункт {item.clauseNumber ?? '—'}
        </span>
        {kind && (
          <span
            className={cn(
              'px-1.5 py-0.5 rounded border text-[10px] font-medium',
              kind.chip,
            )}
          >
            {kind.label}
          </span>
        )}
        {risk && (
          <span
            className={cn(
              'px-1.5 py-0.5 rounded border text-[10px] font-medium',
              risk.chip,
            )}
          >
            {risk.label}
          </span>
        )}
        {item.side && (
          <span className="text-[11px] text-muted-foreground">
            {SIDE[item.side]}
          </span>
        )}
        <button
          onClick={copyForLetter}
          title="Скопировать формулировку для письма контрагенту"
          className="ml-auto text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
        >
          {copied ? (
            <Check size={12} className="text-green-600" />
          ) : (
            <Copy size={12} />
          )}
          {copied ? 'скопировано' : 'для письма'}
        </button>
      </div>

      {item.summary ? (
        <div className="px-4 py-2.5 text-sm">{item.summary}</div>
      ) : (
        <div className="px-4 py-2.5 text-xs text-muted-foreground">
          Оценка не получена — правку проверьте сами. Ниже исходный текст.
        </div>
      )}

      <div className="grid gap-px bg-border sm:grid-cols-2 border-t">
        <div className="bg-background px-4 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Было
          </div>
          <div className="text-xs leading-relaxed whitespace-pre-wrap">
            {item.before ? (
              <ClauseText parts={item.parts} text={item.before} side="left" />
            ) : (
              <span className="text-muted-foreground">пункта не было</span>
            )}
          </div>
        </div>
        <div className="bg-background px-4 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Стало
          </div>
          <div className="text-xs leading-relaxed whitespace-pre-wrap">
            {item.after ? (
              <ClauseText parts={item.parts} text={item.after} side="right" />
            ) : (
              <span className="text-muted-foreground">пункт удалён</span>
            )}
          </div>
        </div>
      </div>

      {(item.reason || item.adviceText) && (
        <div className="px-4 py-2.5 border-t space-y-1.5">
          {item.reason && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <TriangleAlert size={12} className="mt-0.5 shrink-0" />
              {item.reason}
            </p>
          )}
          {item.adviceText && (
            <p className="text-xs flex items-start gap-1.5">
              <Lightbulb size={12} className="mt-0.5 shrink-0 text-amber-500" />
              <span>
                {advice && <b className="mr-1">{advice.label}.</b>}
                {item.adviceText}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
