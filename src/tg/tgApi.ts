import { request } from '@/lib/api';
import type { MemoCard } from '@/lib/api';
import { authHeaders, saveMiniAppToken } from '@/lib/auth';

/** Описание поля формы — то же, что отдаёт кабинет. */
export interface TgFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select';
  required: boolean;
  hint?: string;
  maxLength?: number;
  options?: { value: string; label: string }[];
  requiredWhen?: { key: string; equals: string[] };
}

/** Какие формы умеет приложение. Больше одной — с тех пор как типов два. */
export type TgMemoType =
  'absence' | 'extra_expenses' | 'expedited_invoice' | 'other';

/** Строка расходов в черновике — строками, как её держат поля ввода. */
export interface TgDraftLine {
  expenseType: string;
  counterpartyName: string;
  planned: string;
  actual: string;
}

/**
 * Черновик. Строки расходов — не строка, а массив, поэтому значение шире, чем
 * `string`: именно на этом раньше пропадала бы таблица.
 */
export type TgDraftData = Record<string, string | TgDraftLine[] | undefined>;

export interface TgForm {
  /** Какую форму открыли. Сервер сводит незнакомый тип к отсутствию. */
  memoType: TgMemoType;
  fields: TgFieldDef[];
  departments: { id: string; name: string }[];
  /** Уже приложенные файлы: форма открывается заново, а они остаются. */
  attachments: TgAttachment[];
  /** Справочники, нужные формам. Подписи приходят с сервера, а не зашиты. */
  options: {
    /** Типы перевозки из 1С. От выбранного зависит маршрут согласования. */
    transportationTypes: { id: string; name: string }[];
    reasons: { value: string; label: string }[];
    rebilled: { value: string; label: string }[];
    expenseBearers: { value: string; label: string }[];
    currencies: string[];
    maxExpenseLines: number;
    /** Сколько файлов принимает одна записка. */
    maxAttachments: number;
  };
  /** Незаконченная форма, если человек не дозаполнил её в прошлый раз. */
  draft: { memoType: TgMemoType; data: TgDraftData; updatedAt: string } | null;
}

/** Сотрудник в подсказке: кроме имени и отдела сервер ничего не отдаёт. */
export interface TgEmployee {
  id: string;
  name: string;
  department: { id: string; name: string } | null;
}

/** Файл, приложенный к заполняемой форме. */
export interface TgAttachment {
  id: string;
  name: string;
  size: number;
  mime: string;
}

export interface TgSession {
  token: string;
  employee: { id: string; name: string };
  expiresIn: string;
}

export interface CreatedMemo {
  id: string;
  number: string;
  title: string;
}

/**
 * Запись истории — то же, что отдаёт кабинету `GET memos/:id/history`.
 *
 * `roleName` и `source` есть только у решений согласующих: события журнала
 * роли не знают.
 */
export interface TgHistoryEntry {
  at: string;
  kind: string;
  actorName: string | null;
  roleName: string | null;
  stepNo: number | null;
  attempt: number | null;
  comment: string | null;
  source: string | null;
}

/** Строка расходов в том виде, в каком её отправляют на сервер. */
export interface TgExpenseLine {
  expenseType: string;
  counterpartyName: string;
  counterpartyId?: string;
  planned: number;
  actual: number;
}

/** Таблица расходов целиком — и для создания, и для замены при доработке. */
export interface TgExtraExpenseBody {
  orderNumber: string;
  transportationTypeId: string;
  currency: string;
  lines: TgExpenseLine[];
  incomePlanned: number;
  incomeActual: number;
  reason: string;
  rebilled: string;
  expenseBearer?: string;
  contractorClaim?: string;
  responsibleDepartmentId?: string;
  responsibleEmployeeId?: string;
}

export const tgApi = {
  /**
   * Обмен подписанных данных Telegram на токен.
   *
   * Запрос идёт в обход общего обработчика: его 401 означает «подпись не
   * подошла», а не «сеанс истёк», и подменять настоящую причину нельзя —
   * именно на этом я потерял время при первом запуске.
   */
  async session(initData: string): Promise<TgSession> {
    const res = await fetch('/api/memo-tg/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        message?: { message?: unknown } | unknown;
      };
      const outer = (body as { message?: unknown }).message;
      const raw =
        outer && typeof outer === 'object' && !Array.isArray(outer)
          ? (outer as { message?: unknown }).message
          : outer;
      const text = Array.isArray(raw)
        ? raw.join('; ')
        : typeof raw === 'string'
          ? raw
          : `Ошибка ${res.status}`;
      throw new Error(text);
    }
    const session = (await res.json()) as TgSession;
    saveMiniAppToken(session.token);
    return session;
  },

  form(type?: TgMemoType): Promise<TgForm> {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return request<TgForm>(`/memo-tg/form${query}`);
  },

  saveDraft(data: TgDraftData): Promise<{ ok: true }> {
    return request<{ ok: true }>('/memo-tg/draft', {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
  },

  /**
   * Приложить файл к заполняемой форме.
   *
   * Отдельно от общего `request`, как и загрузки тарифов: тело — multipart, а
   * общая обёртка ставит `Content-Type: application/json`, и браузер тогда не
   * допишет границу частей — сервер такое тело не разберёт.
   */
  async addAttachment(file: File): Promise<TgAttachment> {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/memo-tg/attachments', {
      method: 'POST',
      headers: authHeaders(),
      body,
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        message?: unknown;
      };
      const text = Array.isArray(payload.message)
        ? payload.message.join('; ')
        : typeof payload.message === 'string'
          ? payload.message
          : 'Файл не приложился';
      throw new Error(text);
    }
    return (await res.json()) as TgAttachment;
  },

  removeAttachment(id: string): Promise<{ removed: boolean }> {
    return request<{ removed: boolean }>(`/memo-tg/attachments/${id}`, {
      method: 'DELETE',
    });
  },

  /** Подсказки «в зоне ответственности кого». Меньше двух букв сервер не ищет. */
  employees(q: string): Promise<TgEmployee[]> {
    return request<TgEmployee[]>(
      `/memo-tg/employees?q=${encodeURIComponent(q)}`,
    );
  },

  dropDraft(): Promise<{ ok: true }> {
    return request<{ ok: true }>('/memo-tg/draft', { method: 'DELETE' });
  },

  create(input: {
    reason: string;
    reasonOther?: string;
    dateFrom: string;
    dateTo: string;
    comment?: string;
    departmentId?: string;
  }): Promise<CreatedMemo> {
    return request<CreatedMemo>('/memo-tg/memos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Обоснование доп. расходов.
   *
   * Отдельный адрес, а не общий `memos`: там тело описано полями отсутствия, и
   * проверка на сервере отвергла бы эту форму целиком.
   */
  createExtraExpenses(input: {
    orderNumber: string;
    transportationTypeId: string;
    currency: string;
    lines: {
      expenseType: string;
      counterpartyName: string;
      planned: number;
      actual: number;
    }[];
    incomePlanned: number;
    incomeActual: number;
    reason: string;
    rebilled: string;
    expenseBearer?: string;
    contractorClaim?: string;
    responsibleDepartmentId?: string;
    responsibleEmployeeId?: string;
    departmentId?: string;
  }): Promise<CreatedMemo & { overrun: string }> {
    return request<CreatedMemo & { overrun: string }>(
      '/memo-tg/extra-expenses',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Ускоренное выставление счёта (АВР).
   *
   * Свой адрес, как у доп. расходов: у общего `memos` тело описано полями
   * отсутствия, и проверка на сервере отвергла бы эту форму целиком.
   */
  // ── Существующая записка ──

  /** Карточка записки. Тот же состав, что в кабинете — служба на сервере одна. */
  memo(id: string): Promise<MemoCard> {
    return request<MemoCard>(`/memo-tg/memos/${id}`);
  },

  /** Вся история одной лентой: события журнала и решения согласующих вместе. */
  history(id: string): Promise<TgHistoryEntry[]> {
    return request<TgHistoryEntry[]>(`/memo-tg/memos/${id}/history`);
  },

  /** Чего не хватает для отправки. По этому ответу гасим кнопку. */
  readiness(id: string): Promise<{ ready: boolean; problems: string[] }> {
    return request(`/memo-tg/memos/${id}/readiness`);
  },

  decide(
    id: string,
    taskId: string,
    decision: 'approve' | 'reject' | 'return',
    comment?: string,
  ): Promise<{ outcome: string }> {
    return request(`/memo-tg/memos/${id}/tasks/${taskId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    });
  },

  /**
   * Правка записки на доработке.
   *
   * Тему и сумму здесь не передаём: у доп. расходов они вычисляются из
   * таблицы, и правка руками развела бы шапку с таблицей.
   */
  editMemo(
    id: string,
    input: { justification?: string; payload?: Record<string, unknown> },
  ): Promise<unknown> {
    return request(`/memo-tg/memos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  /** Заменить таблицу расходов целиком. */
  replaceExpenses(
    id: string,
    input: TgExtraExpenseBody,
  ): Promise<{ title: string }> {
    return request(`/memo-tg/memos/${id}/extra-expenses`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /** Отправить заново после доработки. Ответ на замечание обязателен. */
  resubmit(id: string, reply: string): Promise<{ number: string }> {
    return request(`/memo-tg/memos/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ reply }),
    });
  },

  /**
   * Приложить файл к существующей записке.
   *
   * Своим `fetch`, как и у файлов черновика: общий `request` ставит заголовок
   * JSON, и multipart с ним не уходит.
   */
  async addMemoFile(id: string, file: File): Promise<TgAttachment> {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`/api/memo-tg/memos/${id}/attachments`, {
      method: 'POST',
      headers: authHeaders(),
      body,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(data?.message ?? 'Не удалось приложить файл');
    }
    return (await res.json()) as TgAttachment;
  },

  removeMemoFile(id: string, attachmentId: string): Promise<unknown> {
    return request(`/memo-tg/memos/${id}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Прочая записка («Иное»): тема и текст.
   *
   * Свой адрес, как у двух предыдущих: у общего `memos` тело описано полями
   * отсутствия, и проверка на сервере отвергла бы это тело целиком.
   */
  createOther(input: { title: string; text: string }): Promise<CreatedMemo> {
    return request<CreatedMemo>('/memo-tg/other', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  createExpeditedInvoice(input: {
    orderNumber: string;
    transportationTypeId: string;
    counterpartyName: string;
    amount: number;
    currency: string;
    reason: string;
    documentsExpectedAt: string;
    departmentId?: string;
  }): Promise<CreatedMemo> {
    return request<CreatedMemo>('/memo-tg/expedited-invoice', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
