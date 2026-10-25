import { useEffect, useRef, useState } from 'react';
import {
  clearMiniAppToken,
  setMiniAppMode,
  setUnauthorizedHandler,
} from '@/lib/auth';
import AbsenceForm from './AbsenceForm';
import type { AbsenceValues } from './AbsenceForm';
import ExpeditedInvoiceForm, {
  invoiceHasAnything,
  invoiceValuesFromDraft,
} from './ExpeditedInvoiceForm';
import type { InvoiceValues } from './ExpeditedInvoiceForm';
import ExtraExpenseForm, {
  extraHasAnything,
  extraValuesFromDraft,
} from './ExtraExpenseForm';
import type { ExtraExpenseValues } from './ExtraExpenseForm';
import {
  applyTheme,
  close,
  expand,
  initData,
  insideTelegram,
  mainButton,
  ready,
  showAlert,
} from './telegram';
import { tgApi } from './tgApi';
import type { TgDraftData, TgForm, TgMemoType } from './tgApi';
import './miniapp.css';

/** Заполненная форма — своя на каждый тип. */
type Values =
  | { kind: 'absence'; values: AbsenceValues }
  | { kind: 'extra_expenses'; values: ExtraExpenseValues }
  | { kind: 'expedited_invoice'; values: InvoiceValues };

type Stage =
  | { kind: 'booting' }
  | { kind: 'outside' }
  | { kind: 'error'; message: string }
  /** Выбор типа записки. С него начинается всё, кроме продолжения черновика. */
  | { kind: 'choose' }
  | { kind: 'resume'; memoType: TgMemoType; savedAt: string }
  | { kind: 'loading' }
  | { kind: 'form'; form: TgForm; initial: Values | null }
  | { kind: 'sent'; number: string; title: string };

/**
 * Подписи типов. Живут здесь, а не приходят с сервера: формулировку меняют
 * чаще, чем состав типов, и из-за правки слова не должен выкатываться бэкенд.
 */
const TYPE_LABEL: Record<TgMemoType, { title: string; hint: string }> = {
  absence: {
    title: 'Отсутствие на рабочем месте',
    hint: 'Отпуск, больничный, отгул — с какого по какой день',
  },
  extra_expenses: {
    title: 'Обоснование доп. расходов',
    hint: 'Почему по перевозке потратили больше плана',
  },
  expedited_invoice: {
    title: 'Ускоренное выставление счёта (АВР)',
    hint: 'Счёт нужен раньше, чем пришли документы',
  },
};

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

  /** Загрузить форму под тип и открыть её. Черновик подставляем по просьбе. */
  const openForm = async (memoType: TgMemoType, withDraft: boolean) => {
    setStage({ kind: 'loading' });
    try {
      const form = await tgApi.form(memoType);
      const draft = withDraft && form.draft ? form.draft.data : null;
      setStage({
        kind: 'form',
        form,
        initial: draft ? toValues(memoType, draft, form) : null,
      });
    } catch (e) {
      setStage({ kind: 'error', message: (e as Error).message });
    }
  };

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

        // Форму спрашиваем без типа: на этом шаге нужен только черновик, а он
        // один на человека и знает свой тип сам.
        const form = await tgApi.form();
        const draft = form.draft;
        const started = draft
          ? toValues(draft.memoType, draft.data, form)
          : null;

        // Продолжать или начать заново — решает человек. Молча подставлять
        // старое нельзя: он мог забыть, что начинал.
        if (draft && started && hasAnything(started)) {
          setStage({
            kind: 'resume',
            memoType: draft.memoType,
            savedAt: draft.updatedAt,
          });
        } else {
          setStage({ kind: 'choose' });
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

  const heading =
    stage.kind === 'form'
      ? TYPE_LABEL[stage.form.memoType].title
      : stage.kind === 'resume'
        ? TYPE_LABEL[stage.memoType].title
        : 'Служебная записка';

  return (
    <div className="tg-page">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">{heading}</h1>
        {who && <p className="tg-hint-text mt-0.5">{who}</p>}
      </header>

      {(stage.kind === 'booting' || stage.kind === 'loading') && (
        <p className="tg-hint-text">Открываем…</p>
      )}

      {stage.kind === 'outside' && (
        <div className="tg-card space-y-2">
          <p className="text-sm font-medium">Откройте из Telegram</p>
          <p className="tg-hint-text">
            Эта страница работает внутри бота записок: там Telegram передаёт
            подписанные данные, по которым мы узнаём сотрудника. В обычном
            браузере узнавать вас нечем.
          </p>
        </div>
      )}

      {stage.kind === 'error' && (
        <div className="tg-card space-y-3">
          <div className="tg-error">{stage.message}</div>
          <p className="tg-hint-text">
            Если Telegram не привязан, попросите у администратора код и
            отправьте боту <code>/start код</code>.
          </p>
        </div>
      )}

      {stage.kind === 'choose' && (
        <div className="space-y-2">
          <p className="tg-hint-text mb-1">Что оформляем?</p>
          {(Object.keys(TYPE_LABEL) as TgMemoType[]).map((type) => (
            <button
              key={type}
              className="tg-choice"
              onClick={() => void openForm(type, false)}
            >
              <span className="text-sm font-medium">
                {TYPE_LABEL[type].title}
              </span>
              <span className="tg-hint-text block mt-0.5">
                {TYPE_LABEL[type].hint}
              </span>
            </button>
          ))}
        </div>
      )}

      {stage.kind === 'resume' && (
        <div className="tg-card space-y-3">
          <p className="text-sm font-medium">Продолжить заполнение?</p>
          <p className="tg-hint-text">
            Вы начали записку «{TYPE_LABEL[stage.memoType].title}»{' '}
            {savedAgo(stage.savedAt)} и не отправили её.
          </p>
          <div className="space-y-2">
            <button
              className="tg-button"
              onClick={() => void openForm(stage.memoType, true)}
            >
              Продолжить
            </button>
            <button
              className="tg-button-secondary"
              onClick={() => {
                void tgApi.dropDraft().catch(() => undefined);
                setStage({ kind: 'choose' });
              }}
            >
              Начать заново
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'form' && stage.form.memoType === 'absence' && (
        <AbsenceForm
          form={stage.form}
          initial={
            stage.initial?.kind === 'absence' ? stage.initial.values : null
          }
          onSent={(memo) => setStage({ kind: 'sent', ...memo })}
        />
      )}

      {stage.kind === 'form' && stage.form.memoType === 'extra_expenses' && (
        <ExtraExpenseForm
          form={stage.form}
          initial={
            stage.initial?.kind === 'extra_expenses'
              ? stage.initial.values
              : null
          }
          onSent={(memo) => setStage({ kind: 'sent', ...memo })}
        />
      )}

      {stage.kind === 'form' && stage.form.memoType === 'expedited_invoice' && (
        <ExpeditedInvoiceForm
          form={stage.form}
          initial={
            stage.initial?.kind === 'expedited_invoice'
              ? stage.initial.values
              : null
          }
          onSent={(memo) => setStage({ kind: 'sent', ...memo })}
        />
      )}

      {stage.kind === 'sent' && (
        <div className="tg-card space-y-2">
          <p className="text-sm font-medium">
            Записка {stage.number} отправлена
          </p>
          <p className="tg-hint-text">{stage.title}</p>
          <p className="tg-hint-text">
            Согласующие получат уведомление. Ход согласования виден в личном
            кабинете.
          </p>
          <button className="tg-button" onClick={close}>
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}

/** Черновик с сервера — в значения нужной формы. */
function toValues(
  memoType: TgMemoType,
  data: TgDraftData,
  form: TgForm,
): Values {
  if (memoType === 'expedited_invoice') {
    return {
      kind: 'expedited_invoice',
      values: invoiceValuesFromDraft(data, form.options.currencies[0] ?? 'UZS'),
    };
  }
  if (memoType === 'extra_expenses') {
    return {
      kind: 'extra_expenses',
      values: extraValuesFromDraft(data, form.options.currencies[0] ?? 'UZS'),
    };
  }
  const text = (key: string): string => {
    const raw = data[key];
    return typeof raw === 'string' ? raw : '';
  };
  return {
    kind: 'absence',
    values: {
      reason: text('reason'),
      reasonOther: text('reasonOther'),
      dateFrom: text('dateFrom'),
      dateTo: text('dateTo'),
      comment: text('comment'),
    },
  };
}

/** Есть ли в черновике хоть что-то. Пустой предлагать продолжать незачем. */
function hasAnything(started: Values): boolean {
  if (started.kind === 'extra_expenses')
    return extraHasAnything(started.values);
  if (started.kind === 'expedited_invoice')
    return invoiceHasAnything(started.values);
  return Object.values(started.values).some((v) => v.trim() !== '');
}

function savedAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  return `${Math.round(hours / 24)} дн. назад`;
}
