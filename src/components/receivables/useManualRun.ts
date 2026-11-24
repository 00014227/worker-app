import { useEffect, useRef, useState } from 'react';
import { receivablesApi, type DunningRunState } from '@/lib/api';

/** Как часто спрашивать сервер, закончился ли прогон. */
const POLL_INTERVAL_MS = 3000;

/**
 * Кнопка «Прогнать сейчас». Прогон идёт около минуты, а прокси Netlify рвёт запрос
 * через ~26 с — поэтому сервер запускает его в фоне, а мы опрашиваем статус.
 * Открыли страницу, пока прогон уже идёт (перезагрузили, нажал коллега), — тоже ждём.
 */
export function useManualRun({
  canRun,
  onFinished,
}: {
  canRun: boolean;
  onFinished: () => void;
}) {
  const [state, setState] = useState<DunningRunState | null>(null);
  /** Итог показываем только для прогона, который при нас шёл, а не вчерашний. */
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Колбэк меняется на каждом рендере страницы — держим последний, не перезапуская опрос.
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const isRunning = state?.status === 'running';

  useEffect(() => {
    if (!canRun) return;
    receivablesApi
      .runState()
      .then((current) => {
        setState(current);
        if (current.status === 'running') setIsWatching(true);
      })
      .catch(() => {
        // Статус — подсказка; не получили — кнопка просто доступна.
      });
  }, [canRun]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      receivablesApi
        .runState()
        .then((current) => {
          setState(current);
          if (current.status !== 'running') onFinishedRef.current();
        })
        .catch((pollError: Error) => setError(pollError.message));
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const start = async () => {
    setError(null);
    try {
      setState(await receivablesApi.run());
      setIsWatching(true);
    } catch (startError) {
      setError((startError as Error).message);
    }
  };

  return {
    isRunning,
    /** Итог прогона, который шёл при открытой странице; null — показывать нечего. */
    finished:
      isWatching && (state?.status === 'done' || state?.status === 'failed')
        ? state
        : null,
    error,
    start,
  };
}
