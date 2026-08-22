const TOKEN_KEY = 'transasia.worker.token';
const USER_KEY  = 'transasia.worker.user';

export interface WorkerUser {
  id: string;
  name: string;
  bitrix24Id: number | null;
  isAdmin: boolean;
  /** Доступ к разделу проверки контрагентов. */
  isLawyer?: boolean;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): WorkerUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as WorkerUser) : null;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, employee: WorkerUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(employee));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
