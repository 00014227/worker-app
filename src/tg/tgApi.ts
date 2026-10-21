import { request } from '@/lib/api';
import { saveMiniAppToken } from '@/lib/auth';

/** Описание поля формы — то же, что отдаёт кабинет. */
export interface TgFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select';
  required: boolean;
  hint?: string;
  maxLength?: number;
  options?: { value: string; label: string }[];
  requiredWhen?: { key: string; equals: string[] };
}

/** Какие формы умеет приложение. Больше одной — с тех пор как типов два. */
export type TgMemoType = 'absence' | 'extra_expenses';

/** Строка расходов в черновике — строками, как её держат поля ввода. */
export interface TgDraftLine {
  expenseType: string;
  supplierName: string;
  supplierId: string;
  planned: string;
  actual: string;
}

/** Подрядчик в подсказке. Ничего, кроме названия и ИНН, сервер не отдаёт. */
export interface TgSupplier {
  id: string;
  name: string;
  inn: string | null;
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
  /** Справочники, нужные формам. Подписи приходят с сервера, а не зашиты. */
  options: {
    reasons: { value: string; label: string }[];
    rebilled: { value: string; label: string }[];
    currencies: string[];
    maxExpenseLines: number;
  };
  /** Незаконченная форма, если человек не дозаполнил её в прошлый раз. */
  draft: { memoType: TgMemoType; data: TgDraftData; updatedAt: string } | null;
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

  /** Подсказки «кому платим». Меньше двух букв сервер не ищет. */
  suppliers(q: string): Promise<TgSupplier[]> {
    return request<TgSupplier[]>(
      `/memo-tg/suppliers?q=${encodeURIComponent(q)}`,
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
    currency: string;
    lines: {
      expenseType: string;
      supplierName: string;
      supplierId?: string;
      planned: number;
      actual: number;
    }[];
    incomePlanned: number;
    incomeActual: number;
    reason: string;
    rebilled: string;
    culprit?: string;
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
};
