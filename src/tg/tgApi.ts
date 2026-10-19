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
  /** Обмен подписанных данных Telegram на токен. Токен сохраняем сразу. */
  async session(initData: string): Promise<TgSession> {
    const session = await request<TgSession>('/memo-tg/session', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
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
