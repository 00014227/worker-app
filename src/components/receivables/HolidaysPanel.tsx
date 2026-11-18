import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2, X } from 'lucide-react';
import { receivablesApi, type DebtHoliday } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate, formatDateTime, todayYmd } from './receivables-meta';
import {
  Drawer,
  Notice,
  Panel,
  SectionTitle,
  buttonClass,
} from './receivables-ui';

/** «21.03.2026, сб» — дату праздника удобнее проверять с днём недели. */
const formatDay = (ymd: string) =>
  `${formatDate(ymd)}, ${new Date(`${ymd}T00:00:00Z`).toLocaleDateString(
    'ru-RU',
    { weekday: 'short', timeZone: 'UTC' },
  )}`;

const isWeekend = (ymd: string) => {
  const weekday = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
};

/**
 * Праздники Узбекистана — нерабочие дни рассылки. Вносят сотрудники: дни Хайита
 * и переносы выходных объявляют каждый год, в коде их нет.
 */
export function HolidaysPanel({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [holidays, setHolidays] = useState<DebtHoliday[] | null>(null);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPastOpen, setIsPastOpen] = useState(false);

  const loadHolidays = useCallback(
    () =>
      receivablesApi
        .holidays()
        .then(setHolidays)
        .catch((loadError: Error) => setError(loadError.message)),
    [],
  );
  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const today = todayYmd();
  const upcoming = (holidays ?? []).filter((holiday) => holiday.date >= today);
  const past = (holidays ?? [])
    .filter((holiday) => holiday.date < today)
    .reverse();

  const addHoliday = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await receivablesApi.addHoliday({ date, name: name.trim() || undefined });
      setDate('');
      setName('');
      await loadHolidays();
      onChanged();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const removeHoliday = async (holiday: DebtHoliday) => {
    if (!window.confirm(`Убрать праздник ${formatDay(holiday.date)}?`)) return;
    setError(null);
    try {
      await receivablesApi.removeHoliday(holiday.date);
      await loadHolidays();
      onChanged();
    } catch (removeError) {
      setError((removeError as Error).message);
    }
  };

  const renderHoliday = (holiday: DebtHoliday) => (
    <li
      key={holiday.date}
      className="flex items-start justify-between gap-3 py-2.5 text-[13px]"
    >
      <div>
        <div className="font-semibold">
          {formatDay(holiday.date)}
          {holiday.name && ` — ${holiday.name}`}
        </div>
        <div className="text-[12px] text-muted-foreground">
          внёс {holiday.createdBy ?? '—'}, {formatDateTime(holiday.createdAt)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => removeHoliday(holiday)}
        aria-label={`Убрать праздник ${formatDay(holiday.date)}`}
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-red-50 hover:text-red-700"
      >
        <X size={16} />
      </button>
    </li>
  );

  return (
    <Drawer
      title={
        <span className="flex items-center gap-2">
          <CalendarDays size={18} /> Праздники
        </span>
      }
      subtitle="Нерабочие дни рассылки, кроме субботы и воскресенья. В такой день писем нет: письма 1–2 уходят в предыдущий рабочий день (до срока), 3–5 — в следующий."
      widthClass="max-w-md"
      onClose={onClose}
    >
      <Panel className="space-y-3 text-[13px]">
        <div className="space-y-1.5">
          <Label htmlFor="holiday-date" className="text-[13px]">
            Дата
          </Label>
          <input
            id="holiday-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 rounded-[9px] border border-border bg-card px-2.5 text-[14px]"
          />
          {date && isWeekend(date) && (
            <div className="text-amber-800">
              Это суббота или воскресенье — в выходные писем и так нет.
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="holiday-name" className="text-[13px]">
            Название
          </Label>
          <Input
            id="holiday-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={200}
            placeholder="Навруз, Рамазан Хайит, перенос выходного…"
            className="h-9 text-[13px]"
          />
        </div>
        {error && <Notice tone="red">{error}</Notice>}
        <button
          type="button"
          onClick={addHoliday}
          disabled={isSaving || !date}
          className={buttonClass.primary}
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          Добавить
        </button>
      </Panel>

      <section className="space-y-1">
        <SectionTitle>Впереди</SectionTitle>
        {!holidays ? (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Загрузка…
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Праздников не внесено — рассылка идёт по будням.
          </p>
        ) : (
          <ul className="divide-y divide-[#EEF1F6]">
            {upcoming.map(renderHoliday)}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="text-[13px]">
          <button
            type="button"
            onClick={() => setIsPastOpen((open) => !open)}
            aria-expanded={isPastOpen}
            className="text-muted-foreground hover:text-foreground"
          >
            {isPastOpen ? 'Скрыть' : 'Показать'} прошедшие ({past.length})
          </button>
          {isPastOpen && (
            <ul className="mt-1 divide-y divide-[#EEF1F6]">
              {past.map(renderHoliday)}
            </ul>
          )}
        </section>
      )}
    </Drawer>
  );
}
