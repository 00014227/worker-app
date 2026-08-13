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
