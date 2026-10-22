import type {
  MemoDecisionKind,
  MemoFieldDef,
  MemoStatus,
  MemoTaskStatus,
  MemoType,
} from '@/lib/api';

/**
 * Подписи и цвета для записок.
 *
 * В базе статусы латиницей в нижнем регистре — так выглядят все перечисления
 * схемы. Русские подписи живут здесь, рядом с интерфейсом, а не в API: иначе
 * любое изменение формулировки требовало бы выкатки бэкенда.
 */
export const MEMO_STATUS: Record<
  MemoStatus,
  { label: string; chip: string; dot: string }
> = {
  draft: {
    label: 'Черновик',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  pending_approval: {
    label: 'На согласовании',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  changes_requested: {
    label: 'На доработке',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  approved: {
    label: 'Утверждена',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Отклонена',
    chip: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  cancelled: {
    label: 'Отменена',
    chip: 'bg-slate-100 text-slate-500 border-slate-200',
    dot: 'bg-slate-300',
  },
};

/**
 * Подписи типов. Прежние четыре обязаны остаться: их убрали из выбора, но
 * записки открываются, и карточка ищет подпись здесь по типу из базы.
 */
export const MEMO_TYPE: Record<MemoType, { label: string; short: string }> = {
  absence: { label: 'Отсутствие на рабочем месте', short: 'Отсутствие' },
  extra_expenses: { label: 'Обоснование доп. расходов', short: 'Доп. расходы' },
  expedited_invoice: {
    label: 'Ускоренное выставление счёта (АВР)',
    short: 'Ускор. счёт',
  },
  payment: { label: 'Оплата', short: 'Оплата' },
  purchase: { label: 'Закупка', short: 'Закупка' },
  trip: { label: 'Командировка', short: 'Команд.' },
  other: { label: 'Прочая записка', short: 'Прочее' },
};

/** Перевыставлен ли расход клиенту — подписи для карточки. */
export const REBILLED_LABEL: Record<string, string> = {
  yes: 'Перевыставлен клиенту',
  no: 'Не перевыставлен клиенту',
  partial: 'Перевыставлен частично',
};

/** Кто несёт расход, если клиенту он не перевыставлен. */
export const EXPENSE_BEARER_LABEL: Record<string, string> = {
  contractor: 'Платит подрядчик',
  own: 'Платим мы',
};

/** Состояние этапа в маршруте. */
export const TASK_STATUS: Record<
  MemoTaskStatus,
  { label: string; chip: string }
> = {
  waiting: {
    label: 'Ждёт очереди',
    chip: 'bg-slate-100 text-slate-500 border-slate-200',
  },
  pending: {
    label: 'Ждёт решения',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  approved: {
    label: 'Согласовано',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Отклонено',
    chip: 'bg-red-50 text-red-700 border-red-200',
  },
  returned: {
    label: 'Возвращено',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  cancelled: {
    label: 'Снято',
    chip: 'bg-slate-100 text-slate-400 border-slate-200',
  },
  skipped: {
    label: 'Пропущено',
    chip: 'bg-slate-100 text-slate-400 border-slate-200',
  },
};

export const DECISION: Record<
  MemoDecisionKind,
  { label: string; chip: string }
> = {
  approve: {
    label: 'Согласовал',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  reject: { label: 'Отклонил', chip: 'bg-red-50 text-red-700 border-red-200' },
  return: {
    label: 'Вернул на доработку',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

/** Подписи событий журнала. */
export const EVENT_LABEL: Record<string, string> = {
  created: 'Создана',
  submitted: 'Отправлена на согласование',
  resubmitted: 'Подана повторно после доработки',
  step_activated: 'Перешла на следующий этап',
  approved: 'Утверждена',
  rejected: 'Отклонена',
  returned: 'Возвращена на доработку',
  cancelled: 'Отменена',
  attachment_added: 'Приложен файл',
};

/** Деньги: разделители разрядов и валюта рядом. Приходят строкой, без float. */
export function fmtMoney(
  amount: string | null,
  currency: string | null,
): string {
  if (amount === null) return '—';
  const value = Number(amount);
  const text = Number.isFinite(value)
    ? value.toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : amount;
  return currency ? `${text} ${currency}` : text;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

/** Размер файла — килобайты или мегабайты, без лишней точности. */
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/**
 * Насколько просрочена задача. Отрицательное — срок ещё не вышел.
 * Отдаём классом, а не числом: в таблице нужен цвет, а не часы.
 */
export function overdueClass(dueAt: string | null): string {
  if (!dueAt) return 'text-muted-foreground';
  const hours = (Date.now() - new Date(dueAt).getTime()) / 3600_000;
  if (hours > 24) return 'text-red-600 font-medium';
  if (hours > 0) return 'text-amber-600';
  return 'text-muted-foreground';
}

/** Срок понятными словами: «просрочено на 2 дня», «осталось 5 ч». */
export function dueLabel(dueAt: string | null): string {
  if (!dueAt) return '';
  const hours = (Date.now() - new Date(dueAt).getTime()) / 3600_000;
  if (hours > 48) return `просрочено на ${Math.floor(hours / 24)} дн.`;
  if (hours > 0) return `просрочено на ${Math.floor(hours)} ч`;
  const left = Math.abs(hours);
  if (left > 48) return `осталось ${Math.floor(left / 24)} дн.`;
  return `осталось ${Math.max(1, Math.floor(left))} ч`;
}

/**
 * Значение поля в карточке.
 *
 * Дата и дата со временем приходят строками «2026-10-24» и «2026-10-24T15:00»,
 * и показывать их как есть нельзя: согласующий читает документ, а не машинный
 * формат. Час разбираем из строки, а не через `Date`: значение хранится без
 * часового пояса, и разбор сдвинул бы его на машине с другим поясом.
 */
export function fieldValue(
  field: MemoFieldDef,
  value: string | number,
): string {
  const text = String(value);
  if (field.type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : text;
  }
  if (field.type === 'datetime') {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
    return m ? `${m[3]}.${m[2]}.${m[1]} к ${m[4]}:${m[5]}` : text;
  }
  return optionLabel(field, value);
}

/**
 * Подпись выбранного варианта.
 *
 * Без неё карточка показывала бы `vacation` вместо «Отпуск»: в базе лежит
 * значение, а человеку нужна подпись.
 */
export function optionLabel(
  field: MemoFieldDef,
  value: string | number,
): string {
  const found = field.options?.find((o) => o.value === String(value));
  return found ? found.label : String(value);
}
