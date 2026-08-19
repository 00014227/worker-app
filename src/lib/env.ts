/**
 * Контекст сборки. Задаётся Netlify в netlify.toml; локально переменной нет →
 * 'development'. Тестового инстанса бэкенда не существует, поэтому на любом
 * не-production стенде данные боевые: отсюда предупреждающая полоса в Layout и
 * подтверждение перед отправкой приглашений подрядчикам.
 */
export type AppEnv = "production" | "staging" | "preview" | "development";

export const APP_ENV = (import.meta.env.VITE_APP_ENV ??
  "development") as AppEnv;

export const IS_PROD_BUILD = APP_ENV === "production";

export const GIT_BRANCH = import.meta.env.VITE_GIT_BRANCH ?? "";

/** Короткий хеш — полный в баннере не нужен, а место занимает. */
export const GIT_SHA = (import.meta.env.VITE_GIT_SHA ?? "").slice(0, 7);

/** Подпись сборки для баннера: «develop · a1b2c3d». Пусто локально. */
export function buildLabel(): string {
  return [GIT_BRANCH, GIT_SHA].filter(Boolean).join(" · ");
}

/**
 * Подтверждение действия, у которого есть эффект за пределами приложения:
 * сообщение в Telegram живому подрядчику, сделка в Битриксе, импорт контактов.
 * Бэкенд один и всегда боевой, поэтому со стенда и с локального dev-сервера
 * такие действия срабатывают по-настоящему. На проде не спрашиваем — там
 * поведение остаётся прежним.
 *
 * @param what что именно произойдёт, одной фразой
 * @returns можно ли продолжать
 */
export function confirmOnStand(what: string): boolean {
  if (IS_PROD_BUILD) return true;
  return window.confirm(
    `Сборка тестовая, но бэкенд боевой.\n\n${what}\n\nПродолжить?`,
  );
}
