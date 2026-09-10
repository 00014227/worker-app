import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { IS_PROD_BUILD } from '../lib/env';

type Props = { children: ReactNode };
type State = { error: Error | null };

const STALE_CHUNK =
  /dynamically imported module|module script|Unable to preload CSS/i;

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ошибка рендера:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = STALE_CHUNK.test(error.message);

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 py-16 text-center"
      >
        <AlertTriangle className="text-destructive" size={32} />

        <div className="text-base font-medium">
          {stale ? 'Приложение обновилось' : 'Не удалось открыть раздел'}
        </div>

        <p className="max-w-md text-sm text-muted-foreground">
          {stale
            ? 'Открыта старая версия страницы. Обновите её, чтобы продолжить работу.'
            : 'Раздел не отрисовался. Попробуйте открыть его снова, а если повторится — сообщите разработчику.'}
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            <RefreshCw size={14} />
            Обновить страницу
          </button>

          {!stale && (
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Попробовать снова
            </button>
          )}
        </div>

        {!IS_PROD_BUILD && (
          <pre className="mt-2 max-h-48 max-w-full overflow-auto rounded-md bg-muted p-3 text-left text-[11px] text-muted-foreground">
            {error.stack || error.message}
          </pre>
        )}
      </div>
    );
  }
}
