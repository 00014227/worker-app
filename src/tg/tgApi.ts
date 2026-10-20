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

export interface TgForm {
  fields: TgFieldDef[];
  departments: { id: string; name: string }[];
  /** Незаконченная форма, если человек не дозаполнил её в прошлый раз. */
  draft: { data: Record<string, string>; updatedAt: string } | null;
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

  form(): Promise<TgForm> {
    return request<TgForm>('/memo-tg/form');
  },

  saveDraft(data: Record<string, string>): Promise<{ ok: true }> {
    return request<{ ok: true }>('/memo-tg/draft', {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
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
};
