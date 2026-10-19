import { useEffect, useRef, useState } from 'react';
import { clearMiniAppToken, setMiniAppMode, setUnauthorizedHandler } from '@/lib/auth';
import AbsenceForm from './AbsenceForm';
import type { AbsenceValues } from './AbsenceForm';
import { applyTheme, close, expand, initData, insideTelegram, mainButton, ready, showAlert } from './telegram';
import { tgApi } from './tgApi';
import type { TgForm } from './tgApi';
import './miniapp.css';

type Stage =
  | { kind: 'booting' }
  | { kind: 'outside' }
  | { kind: 'error'; message: string }
  | { kind: 'resume'; form: TgForm; draft: AbsenceValues; savedAt: string }
  | { kind: 'form'; form: TgForm; initial: AbsenceValues | null }
  | { kind: 'sent'; number: string; title: string };

/**
 * Mini App служебных записок — то, что открывается кнопкой в Telegram.
 *
 * Страница живёт вне защищённой области кабинета: человек опознаётся по
 * подписанным данным Telegram, и логин в кабинете ему не нужен. Поэтому и
 * маршрут объявлен рядом с входом, а не внутри раздела с сайдбаром.
 */
export default function MiniAppPage() {
  const [stage, setStage] = useState<Stage>({ kind: 'booting' });
  const [who, setWho] = useState<string | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    // Защита от двойного вызова в строгом режиме: обмен данных на токен
    // выполняется один раз.
    if (booted.current) return;
    booted.current = true;

    ready();
    expand();
    const stopTheme = applyTheme();

    // В WebView переход на страницу входа выглядит поломкой, поэтому при 401
    // объясняем и закрываем приложение.
    setMiniAppMode(true);
    setUnauthorizedHandler(() => {
      clearMiniAppToken();
      showAlert('Сеанс истёк. Откройте приложение заново.', close);
    });

    if (!insideTelegram()) {
      setStage({ kind: 'outside' });
      return stopTheme;
    }

    const boot = async () => {
      try {
        const session = await tgApi.session(initData());
        setWho(session.employee.name);

        const form = await tgApi.form();
        const draft = form.draft ? toValues(form.draft.data) : null;

        // Продолжать или начать заново — решает человек. Молча подставлять
        // старое нельзя: он мог забыть, что начинал.
        if (draft && hasAnything(draft)) {
          setStage({ kind: 'resume', form, draft, savedAt: form.draft!.updatedAt });
        } else {
          setStage({ kind: 'form', form, initial: null });
        }
      } catch (e) {
        setStage({ kind: 'error', message: (e as Error).message });
      }
    };
    void boot();
    return stopTheme;
  }, []);

  // Нижняя кнопка принадлежит форме — на остальных экранах её скрываем.
  useEffect(() => {
    if (stage.kind !== 'form') mainButton()?.hide();
  }, [stage.kind]);

  return (
    <div className="tg-page">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Отсутствие на рабочем месте</h1>
        {who && <p className="tg-hint-text mt-0.5">{who}</p>}
      </header>

      {stage.kind === 'booting' && <p className="tg-hint-text">Открываем…</p>}

      {stage.kind === 'outside' && (
        <div className="tg-card space-y-2">
          <p className="text-sm font-medium">Откройте из Telegram</p>
          <p className="tg-hint-text">
            Эта страница работает внутри бота записок: там Telegram передаёт подписанные данные, по
            которым мы узнаём сотрудника. В обычном браузере узнавать вас нечем.
          </p>
        </div>
      )}

      {stage.kind === 'error' && (
        <div className="tg-card space-y-3">
          <div className="tg-error">{stage.message}</div>
          <p className="tg-hint-text">
            Если Telegram не привязан, попросите у администратора код и отправьте боту
            {' '}
            <code>/start код</code>.
          </p>
        </div>
      )}

      {stage.kind === 'resume' && (
        <div className="tg-card space-y-3">
          <p className="text-sm font-medium">Продолжить заполнение?</p>
          <p className="tg-hint-text">
            Вы начали записку {savedAgo(stage.savedAt)} и не отправили её.
          </p>
          <div className="space-y-2">
            <button
              className="tg-button"
              onClick={() => setStage({ kind: 'form', form: stage.form, initial: stage.draft })}
            >
              Продолжить
            </button>
            <button
              className="tg-button-secondary"
              onClick={() => {
                void tgApi.dropDraft().catch(() => undefined);
                setStage({ kind: 'form', form: stage.form, initial: null });
              }}
            >
              Начать заново
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'form' && (
        <AbsenceForm
          form={stage.form}
          initial={stage.initial}
          onSent={(memo) => setStage({ kind: 'sent', ...memo })}
        />
      )}

      {stage.kind === 'sent' && (
        <div className="tg-card space-y-2">
          <p className="text-sm font-medium">Записка {stage.number} отправлена</p>
          <p className="tg-hint-text">{stage.title}</p>
          <p className="tg-hint-text">
            Согласующие получат уведомление. Ход согласования виден в личном кабинете.
          </p>
          <button className="tg-button" onClick={close}>
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}

/** Черновик с сервера — в значения формы. Неизвестные ключи отбрасываем. */
function toValues(data: Record<string, string>): AbsenceValues {
  return {
    reason: data.reason ?? '',
    reasonOther: data.reasonOther ?? '',
    dateFrom: data.dateFrom ?? '',
    dateTo: data.dateTo ?? '',
    comment: data.comment ?? '',
    departmentId: data.departmentId ?? '',
  };
}

/** Есть ли в черновике хоть что-то. Пустой предлагать продолжать незачем. */
function hasAnything(values: AbsenceValues): boolean {
  return Object.values(values).some((v) => v.trim() !== '');
}

function savedAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  return `${Math.round(hours / 24)} дн. назад`;
}
