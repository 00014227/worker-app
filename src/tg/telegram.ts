/**
 * Обёртка над Telegram WebApp.
 *
 * Каждый вызов безвреден, когда Telegram отсутствует: так страницу можно
 * открыть в обычном браузере и доработать вид, не собирая сборку под Telegram.
 */

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

interface TelegramMainButton {
  text: string;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  setText(text: string): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string } };
  themeParams?: TelegramThemeParams;
  colorScheme?: 'light' | 'dark';
  MainButton: TelegramMainButton;
  ready(): void;
  expand(): void;
  close(): void;
  showAlert(message: string, cb?: () => void): void;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function tg(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/** Открыто ли приложение из Telegram. Без подписанных данных работать нечем. */
export function insideTelegram(): boolean {
  return !!tg()?.initData;
}

export function initData(): string {
  return tg()?.initData ?? '';
}

/** Сообщаем Telegram, что можно убирать свой загрузчик. */
export function ready(): void {
  tg()?.ready();
}

/**
 * Разворачиваем на всю высоту. Без этого лист открывается примерно в половину
 * экрана, и поля выбора даты оказываются под краем.
 */
export function expand(): void {
  tg()?.expand();
}

export function close(): void {
  tg()?.close();
}

/** Сообщение средствами Telegram: родной диалог вместо `window.alert`. */
export function showAlert(message: string, cb?: () => void): void {
  const app = tg();
  if (app) app.showAlert(message, cb);
  else cb?.();
}

export function mainButton(): TelegramMainButton | null {
  return tg()?.MainButton ?? null;
}

/**
 * Переносит цвета Telegram в свойства CSS, чтобы приложение не выглядело чужим
 * в тёмной теме. Возвращает отписку.
 */
export function applyTheme(): () => void {
  const paint = () => {
    const app = tg();
    const params = app?.themeParams;
    if (!params) return;
    const root = document.documentElement;
    const set = (name: string, value?: string) => {
      if (value) root.style.setProperty(name, value);
    };
    set('--tg-bg', params.bg_color);
    set('--tg-text', params.text_color);
    set('--tg-hint', params.hint_color);
    set('--tg-link', params.link_color);
    set('--tg-button', params.button_color);
    set('--tg-button-text', params.button_text_color);
    set('--tg-secondary-bg', params.secondary_bg_color);
  };

  paint();
  const app = tg();
  app?.onEvent('themeChanged', paint);
  return () => app?.offEvent('themeChanged', paint);
}
