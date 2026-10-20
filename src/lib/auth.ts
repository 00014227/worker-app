const TOKEN_KEY = 'transasia.worker.token';
const USER_KEY = 'transasia.worker.user';
/** Токен Mini App в Telegram. Отдельный: это другая область доступа. */
const MINIAPP_TOKEN_KEY = 'transasia.memo.tg.token';

/**
 * Работаем ли внутри Mini App.
 *
 * Флаг, а не вычисление по адресу: `authHeaders()` зовут из обычных функций,
 * где нет ни состояния React, ни маршрутизатора. Выставляется один раз при
 * загрузке приложения — до первого запроса.
 */
let miniAppMode = false;

export function setMiniAppMode(on: boolean): void {
  miniAppMode = on;
}

export function isMiniAppMode(): boolean {
  return miniAppMode;
}

export function getMiniAppToken(): string | null {
  return sessionStorage.getItem(MINIAPP_TOKEN_KEY);
}

/**
 * Храним в sessionStorage, а не в localStorage: токен живёт 12 часов и
 * привязан к одному открытию приложения, а строка от Telegram всё равно
 * запрашивается заново при каждом входе.
 */
export function saveMiniAppToken(token: string): void {
  sessionStorage.setItem(MINIAPP_TOKEN_KEY, token);
}

export function clearMiniAppToken(): void {
  sessionStorage.removeItem(MINIAPP_TOKEN_KEY);
}

/**
 * Что делать при 401. По умолчанию — выкинуть на страницу входа; Mini App
 * подменяет, потому что в WebView переход на вход выглядит поломкой.
 */
let onUnauthorized: () => void = () => {
  clearAuth();
  window.location.href = '/login';
};

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export function handleUnauthorized(): void {
  onUnauthorized();
}

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

/**
 * Пускать ли в кабинет. Читает **только** кабинетный токен: иначе
 * `ProtectedRoute` впустил бы пользователя Mini App в раздел с сайдбаром,
 * куда его токен всё равно не пускает на сервере.
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Заголовок авторизации. Выбирает токен по режиму — поэтому все запросы, в том
 * числе «сырые» `fetch` для файлов, получают нужный токен без своих правок.
 */
export function authHeaders(): Record<string, string> {
  const token = miniAppMode ? getMiniAppToken() : getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
