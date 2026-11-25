import type {
  DebtLetterStatus,
  DebtMailMode,
  DebtStopReason,
  DebtorDocument,
  DidoxActStatus,
  MoneyByCurrency,
} from '@/lib/api';

/** Цветовые тона меток — одни и те же на всей странице. */
export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red';

export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-800',
  green: 'bg-emerald-50 text-emerald-800',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-800',
};

export const LETTER_STATUS: Record<
  DebtLetterStatus,
  { label: string; tone: Tone }
> = {
  dry_run: { label: 'Только в журнале', tone: 'neutral' },
  // Из старой схемы с претензией в системе; новые письма так не помечаются.
  pending_approval: {
    label: 'Ждал утверждения (старая схема)',
    tone: 'neutral',
  },
  queued: { label: 'В очереди', tone: 'blue' },
  sending: { label: 'Отправляется', tone: 'blue' },
  sent: { label: 'Отправлено', tone: 'green' },
  error: { label: 'Ошибка отправки', tone: 'red' },
  cancelled: { label: 'Отменено', tone: 'neutral' },
};

export const MAIL_MODE: Record<
  DebtMailMode,
  { label: string; hint: string; tone: Tone }
> = {
  'dry-run': {
    label: 'Режим проверки',
    hint: 'письма только записываются в журнал, клиентам ничего не уходит',
    tone: 'neutral',
  },
  'test': {
    label: 'Тестовый режим',
    hint: 'письма уходят на тестовый ящик, а не клиентам',
    tone: 'amber',
  },
  'live': {
    label: 'Боевой режим',
    hint: 'письма уходят клиентам',
    tone: 'red',
  },
};

/** Куда уйдут письма после прогона — для текста подтверждения. */
export const RUN_DESTINATION: Record<DebtMailMode, string> = {
  'dry-run': 'останутся только в журнале (режим проверки)',
  'test': 'уйдут на тестовый ящик',
  'live': 'уйдут клиентам',
};

/** Почему письмо не ушло — для итога прогона. */
export const STOP_REASON_LABELS: Record<DebtStopReason, string> = {
  no_email: 'нет email',
  dispute: 'спор по сумме',
  claim: 'претензия направлена',
  no_term: 'в 1С нет срока или даты АВР',
  paused: 'рассылка на паузе',
  didox_rejected: 'клиент отказался подписать счёт-фактуру в Didox',
  no_invoice: 'нет счёта-фактуры в Didox',
};

export const formatMoney = (money: MoneyByCurrency) =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
    Number(money.amount),
  )} ${money.currency}`;

/** Суммы в разных валютах не складываем — показываем через «+». */
export const formatMoneyList = (items: MoneyByCurrency[]) =>
  items.map(formatMoney).join(' + ');

/** YYYY-MM-DD → ДД.ММ.ГГГГ без Date: иначе часовой пояс сдвинет день. */
export const formatDate = (ymd: string) => ymd.split('-').reverse().join('.');

/** Сегодня по Ташкенту, YYYY-MM-DD — по этому календарю считаются просрочка и отсрочка. */
export const todayYmd = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(
    new Date(),
  );

export const addDaysYmd = (ymd: string, days: number) => {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** ДД.ММ, а для сегодняшней даты — «сегодня». */
export const formatShortDate = (ymd: string) =>
  ymd === todayYmd()
    ? 'сегодня'
    : ymd.split('-').reverse().slice(0, 2).join('.');

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Время прогона по Ташкенту: «вторник, 20 октября в 10:00». */
export const formatRunTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent',
  });

/** Итог по валютам для сводки: точность до копейки тут не нужна. */
export function sumMoney(items: MoneyByCurrency[]): MoneyByCurrency[] {
  const sums = new Map<string, number>();
  for (const money of items) {
    sums.set(
      money.currency,
      (sums.get(money.currency) ?? 0) + Number(money.amount),
    );
  }
  return [...sums].map(([currency, amount]) => ({
    currency,
    amount: String(amount),
  }));
}

/** Тон дней просрочки: 30+ — письмо 5, 14+ — письмо 4. */
export function overdueTone(days: number | null): Tone {
  if (days === null || days <= 0) return 'neutral';
  if (days >= 30) return 'red';
  if (days >= 14) return 'amber';
  return 'blue';
}

/** «просрочка 5 дн.», «срок сегодня», «через 3 дн.». */
export function overdueLabel(days: number): string {
  if (days > 0) return `просрочка ${days} дн.`;
  if (days === 0) return 'срок сегодня';
  return `через ${-days} дн.`;
}

/** От чего отсчитан срок — «после подписи в Didox», «в день акта». */
const TERM_FROM = {
  signed: 'подписи в Didox',
  deemed: 'принятия',
  act_date: 'акта',
} as const;

/** «30 дн. после подписи в Didox», «5 банк. дн. после акта» — откуда срок оплаты. */
export function termLabel(document: DebtorDocument): string {
  if (document.termDays === null) return '';
  const unit =
    document.termUnit === 'banking'
      ? ' банк.'
      : document.termUnit === 'working'
        ? ' раб.'
        : '';
  const from = TERM_FROM[document.termStartSource ?? 'act_date'];
  const days =
    document.termDays === 0
      ? `в день ${from}`
      : `${document.termDays}${unit} дн. после ${from}`;
  return document.dueDateSource === 'payment_term'
    ? `${days} (справочник)`
    : days;
}

/**
 * Что со счётом-фактурой в Didox — одной меткой и пояснением. null — Didox не проверяли
 * (не настроен): срок, как и раньше, от даты акта, метку не показываем.
 */
export function didoxBadge(
  document: DebtorDocument,
): { label: string; hint: string; tone: Tone } | null {
  const status: DidoxActStatus | null = document.didoxStatus;
  if (!status) return null;
  const sent = document.didoxSentOn
    ? `отправлена ${formatDate(document.didoxSentOn)}`
    : '';
  const noLetter =
    'срок не считаем, письмом не отправляется, случай в ежедневном отчёте';
  switch (status) {
    case 'signed':
      return {
        label: document.acceptedOn
          ? `С/ф подписана ${formatShortDate(document.acceptedOn)}`
          : 'С/ф подписана',
        hint: [sent, 'срок оплаты — от дня подписи'].filter(Boolean).join(', '),
        tone: 'green',
      };
    case 'pending':
      return {
        label: 'С/ф ждёт подписи',
        hint: [
          sent,
          document.termStart &&
            `не подпишет — считается принятой ${formatDate(document.termStart)}`,
        ]
          .filter(Boolean)
          .join(', '),
        tone: 'amber',
      };
    case 'rejected':
      return {
        label: 'Отказ по с/ф',
        hint: 'клиент отказался подписать счёт-фактуру — это спор: письмом не отправляется, случай в ежедневном отчёте',
        tone: 'red',
      };
    case 'not_found':
      return {
        label: 'Нет с/ф в Didox',
        hint: `счёт-фактуру к акту в Didox не нашли — ${noLetter}`,
        tone: 'red',
      };
    case 'unmatched':
      return {
        label: 'С/ф не сопоставлена',
        hint: `в Didox несколько похожих счетов-фактур, автоматически не связали — ${noLetter}`,
        tone: 'red',
      };
    case 'no_inn':
      return {
        label: 'Нет ИНН для Didox',
        hint: `в 1С у клиента нет верного ИНН, счёт-фактуру не найти — ${noLetter}`,
        tone: 'red',
      };
  }
}

/** Пауза рассылки: «до 15.12.2026» или «бессрочно». */
export const pauseLabel = (until: string | null) =>
  until ? `до ${formatDate(until)}` : 'бессрочно';
