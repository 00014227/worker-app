/// <reference types="vite/client" />

declare module '*.png' {
  const value: string;
  export default value;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** production | staging | preview — проставляется Netlify по контексту сборки. */
  readonly VITE_APP_ENV?: string;
  readonly VITE_GIT_BRANCH?: string;
  readonly VITE_GIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
