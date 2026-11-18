import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import {
  receivablesApi,
  DEFERRAL_REASON_LABELS,
  type DebtDeferralReason,
  type DebtorDeferral,
} from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  addDaysYmd,
  formatDate,
  formatDateTime,
  todayYmd,
} from './receivables-meta';
import { Panel, SectionTitle, buttonClass } from './receivables-ui';
import { HistoryList } from './HistoryList';

/** Дольше нельзя — бэкенд не примет (DEBT_DEFERRAL_MAX_DAYS). */
const DEFERRAL_MAX_DAYS = 90;
const QUICK_DAYS = [3, 7, 14, 30];

/**
 * Отсрочка: клиент прислал платёжку или договорился о графике — новый крайний срок
 * оплаты. Письма 2–5 считаются заново от него (письмо 2 — за 2 дня до срока),
 * письмо 1 повторно не уходит. Ставить может любой сотрудник — платёжки и звонки
 * приходят в бухгалтерию; кто поставил, видно в истории.
 */
export function DeferralSection({
  customerId,
  deferrals,
  onChanged,
}: {
  customerId: string;
  deferrals: DebtorDeferral[];
  onChanged: () => void;
}) {
  const active = deferrals.find((deferral) => deferral.active) ?? null;
  const past = deferrals.filter((deferral) => !deferral.active);
  const [isEditing, setIsEditing] = useState(false);
  const [until, setUntil] = useState(() => addDaysYmd(todayYmd(), 7));
  const [reason, setReason] = useState<DebtDeferralReason>('payment_order');
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await receivablesApi.defer(customerId, {
        until,
        reason,
        comment: comment.trim() || undefined,
      });
      setIsEditing(false);
      setComment('');
      onChanged();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelDeferral = async () => {
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
    } catch (cancelError) {
      setError((cancelError as Error).message);
    }
  };

  const startEditing = () => {
    if (active) {
      setUntil(addDaysYmd(active.until, 7));
      setReason(active.reason);
    }
    setIsEditing(true);
  };

  return (
    <section className="space-y-2.5">
      <SectionTitle>Отсрочка</SectionTitle>

      {active && !isEditing && (
        <Panel className="space-y-1.5 border-blue-200 bg-blue-50/60 text-[13px]">
          <div className="flex items-center gap-1.5 font-semibold text-blue-900">
            <CalendarClock size={15} /> Новый срок оплаты —{' '}
            {formatDate(active.until)} · {DEFERRAL_REASON_LABELS[active.reason]}
          </div>
          {active.comment && (
            <div className="whitespace-pre-wrap">{active.comment}</div>
          )}
          <div className="text-[12px] text-muted-foreground">
            Поставил {active.createdBy ?? '—'},{' '}
            {formatDateTime(active.createdAt)}. Письма считаются от нового
            срока: письмо 2 — за 2 дня до него, 3–5 — после. Оплата дойдёт до 1С
            — кейс закроется сам.
          </div>
          <div className="flex gap-4 pt-1">
            <button
              type="button"
              onClick={startEditing}
              className={buttonClass.link}
            >
              Продлить или изменить
            </button>
            <button
              type="button"
              onClick={cancelDeferral}
              className={buttonClass.danger}
            >
              Снять отсрочку
            </button>
          </div>
        </Panel>
      )}

      {!active && !isEditing && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startEditing}
            className={buttonClass.outline}
          >
            <CalendarClock size={15} /> Поставить отсрочку
          </button>
          <span className="text-[12px] text-muted-foreground">
            Прислал платёжку или договорился о графике — письма считаются от
            нового срока
          </span>
        </div>
      )}

      {isEditing && (
        <Panel className="space-y-4 text-[13px]">
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-[13px] font-medium">Причина</legend>
            <div className="flex flex-wrap gap-1.5">
              {(
                Object.keys(DEFERRAL_REASON_LABELS) as DebtDeferralReason[]
              ).map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setReason(key)}
                  aria-pressed={reason === key}
                  className={cn(
                    'h-8 rounded-full px-3 font-medium transition-colors',
                    reason === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-[#E8ECF3] text-slate-700 hover:bg-[#DDE3EE]',
                  )}
                >
                  {DEFERRAL_REASON_LABELS[key]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="deferral-until" className="text-[13px]">
              Новый срок оплаты
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                id="deferral-until"
                type="date"
                value={until}
                min={addDaysYmd(todayYmd(), 1)}
                max={addDaysYmd(todayYmd(), DEFERRAL_MAX_DAYS)}
                onChange={(event) => setUntil(event.target.value)}
                className="h-9 rounded-[9px] border border-border bg-card px-2.5 text-[14px]"
              />
              {QUICK_DAYS.map((days) => (
                <button
                  type="button"
                  key={days}
                  onClick={() => setUntil(addDaysYmd(todayYmd(), days))}
                  className="h-8 rounded-full bg-[#E8ECF3] px-3 text-slate-700 hover:bg-[#DDE3EE]"
                >
                  +{days} дн.
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deferral-comment" className="text-[13px]">
              Комментарий
            </Label>
            <Textarea
              id="deferral-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              placeholder="Кто звонил и что обещали: «Иванов, 50% до 30.10, остаток до 15.11»"
              className="text-[13px] md:text-[13px]"
            />
          </div>

          {error && <div className="text-red-700">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isSaving || !until}
              className={buttonClass.primary}
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setError(null);
              }}
              className={buttonClass.outline}
            >
              Отмена
            </button>
          </div>
        </Panel>
      )}

      {!isEditing && error && (
        <div className="text-[13px] text-red-700">{error}</div>
      )}

      <HistoryList
        title="прошлые отсрочки"
        items={past.map((deferral) => ({
          ...deferral,
          text: `срок ${formatDate(deferral.until)} · ${DEFERRAL_REASON_LABELS[deferral.reason]}${deferral.comment ? ` — ${deferral.comment}` : ''}`,
        }))}
      />
    </section>
  );
}
