import { useState } from 'react';
import { Ban, Loader2 } from 'lucide-react';
import {
  receivablesApi,
  STOP_KIND_LABELS,
  type DebtStopKind,
  type DebtorStop,
} from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from './receivables-meta';
import { Panel, SectionTitle, buttonClass } from './receivables-ui';
import { HistoryList } from './HistoryList';

/**
 * Стоп для писем клиенту: спор по сумме или претензия уже направлена. Пока стоп
 * стоит, автоматических писем нет, случай попадает в ежедневный отчёт. Ставят и
 * снимают юристы и админы; история остаётся.
 */
export function StopSection({
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
  const active = stops.filter((stop) => stop.active);
  const past = stops.filter((stop) => !stop.active);
  const [kind, setKind] = useState<DebtStopKind | null>(null);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const freeKinds = (Object.keys(STOP_KIND_LABELS) as DebtStopKind[]).filter(
    (stopKind) => !active.some((stop) => stop.kind === stopKind),
  );

  const save = async () => {
    if (!kind) return;
    setIsSaving(true);
    setError(null);
    try {
      await receivablesApi.stop(customerId, {
        kind,
        comment: comment.trim() || undefined,
      });
      setKind(null);
      setComment('');
      onChanged();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelStop = async (stop: DebtorStop) => {
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
    } catch (cancelError) {
      setError((cancelError as Error).message);
    }
  };

  if (!canAct && active.length === 0 && past.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <SectionTitle>Стоп для писем</SectionTitle>

      {active.map((stop) => (
        <Panel
          key={stop.id}
          className="space-y-1.5 border-red-200 bg-red-50/60 text-[13px]"
        >
          <div className="flex items-center gap-1.5 font-semibold text-red-900">
            <Ban size={15} /> {STOP_KIND_LABELS[stop.kind]} — автоматических
            писем нет
          </div>
          {stop.comment && (
            <div className="whitespace-pre-wrap">{stop.comment}</div>
          )}
          <div className="text-[12px] text-muted-foreground">
            Поставил {stop.createdBy ?? '—'}, {formatDateTime(stop.createdAt)}
          </div>
          {canAct && (
            <button
              type="button"
              onClick={() => cancelStop(stop)}
              className={buttonClass.danger}
            >
              Снять
            </button>
          )}
        </Panel>
      ))}

      {canAct && !kind && freeKinds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {freeKinds.map((stopKind) => (
            <button
              type="button"
              key={stopKind}
              onClick={() => setKind(stopKind)}
              className={buttonClass.outline}
            >
              <Ban size={15} /> {STOP_KIND_LABELS[stopKind]}
            </button>
          ))}
          <span className="text-[12px] text-muted-foreground">
            писем клиенту не будет, случай — в ежедневном отчёте
          </span>
        </div>
      )}

      {kind && (
        <Panel className="space-y-3 text-[13px]">
          <div className="font-semibold">{STOP_KIND_LABELS[kind]}</div>
          <div className="space-y-1.5">
            <Label htmlFor="stop-comment" className="text-[13px]">
              Комментарий
            </Label>
            <Textarea
              id="stop-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              placeholder={
                kind === 'dispute'
                  ? 'Что оспаривает клиент: «не согласен с актом TL-00000440»'
                  : 'Когда и кем направлена претензия'
              }
              className="text-[13px] md:text-[13px]"
            />
          </div>
          {error && <div className="text-red-700">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className={buttonClass.primary}
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Поставить стоп
            </button>
            <button
              type="button"
              onClick={() => {
                setKind(null);
                setError(null);
              }}
              className={buttonClass.outline}
            >
              Отмена
            </button>
          </div>
        </Panel>
      )}

      {!kind && error && (
        <div className="text-[13px] text-red-700">{error}</div>
      )}

      <HistoryList
        title="снятые стопы"
        items={past.map((stop) => ({
          ...stop,
          text: `${STOP_KIND_LABELS[stop.kind]}${stop.comment ? ` — ${stop.comment}` : ''}`,
        }))}
      />
    </section>
  );
}
