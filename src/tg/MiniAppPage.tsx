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
import OtherForm, {
  otherHasAnything,
  otherValuesFromDraft,
} from './OtherForm';
import type { OtherValues } from './OtherForm';
import MemoCardScreen from './MemoCardScreen';
import { extraValuesFromCard } from './ExtraExpenseForm';
import type { ReturnNote } from './ExtraExpenseForm';
import type { MemoCard } from '@/lib/api';
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
import type {
  TgAttachment,
  TgDraftData,
  TgFieldDef,
  TgForm,
  TgMemoType,
} from './tgApi';
import './miniapp.css';

/** Заполненная форма — своя на каждый тип. */
type Values =
  | { kind: 'absence'; values: AbsenceValues }
  | { kind: 'extra_expenses'; values: ExtraExpenseValues }
  | { kind: 'expedited_invoice'; values: InvoiceValues }
  | { kind: 'other'; values: OtherValues };

type Stage =
  | { kind: 'booting' }
  | { kind: 'outside' }
  | { kind: 'error'; message: string }
  /** Выбор типа записки. С него начинается всё, кроме продолжения черновика. */
  | { kind: 'choose' }
  | { kind: 'resume'; memoType: TgMemoType; savedAt: string }
  | { kind: 'loading' }
  | { kind: 'form'; form: TgForm; initial: Values | null }
  /** Карточка существующей записки — её открывают кнопкой из бота. */
  | { kind: 'card'; memoId: string; fields: TgFieldDef[] }
  /** Правка вернувшейся записки: та же форма, но по существующему документу. */
  | {
      kind: 'edit';
      form: TgForm;
      initial: Values;
      memoId: string;
      note: ReturnNote | null;
      /** Ответ на замечание из черновика, если его успели набрать. */
      savedReply: string;
    }
  | { kind: 'sent'; number: string; title: string }
  /** Решение принято — показываем итог и закрываем. */
  | { kind: 'decided'; outcome: string };

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
  other: {
    title: 'Иное',
    hint: 'Своя тема и текст — когда ни один из типов выше не подходит',
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
  // Файлы держим на странице, а не в форме: при переключении типа форма
  // пересоздаётся, а приложенное остаётся на сервере и должно остаться на
  // экране.
  const [files, setFiles] = useState<TgAttachment[]>([]);
  const booted = useRef(false);

  /** Загрузить форму под тип и открыть её. Черновик подставляем по просьбе. */
  const openForm = async (memoType: TgMemoType, withDraft: boolean) => {
    setStage({ kind: 'loading' });
    try {
      const form = await tgApi.form(memoType);
      setFiles(form.attachments);
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

  /**
   * Открыть правку вернувшейся записки.
   *
   * Форму спрашиваем по типу записки, а значения берём из самой записки — так
   * автор правит своё, а не заполняет заново. Замечание согласующего достаём из
   * истории: в карточке оно лежит в решении последнего этапа, а в истории уже
   * сведено с именем и временем.
   */
  const openEdit = async (memo: MemoCard) => {
    setStage({ kind: 'loading' });
    try {
      const [form, history] = await Promise.all([
        tgApi.form(memo.memoType as TgMemoType),
        tgApi.history(memo.id),
      ]);
      setFiles(form.attachments);

      const returned = [...history].reverse().find((h) => h.kind === 'returned');
      const note: ReturnNote | null = returned?.comment
        ? {
            text: returned.comment,
            byName: returned.actorName,
            roleName: returned.roleName,
            at: returned.at,
          }
        : null;

      if (memo.memoType !== 'extra_expenses') {
        // Правка остальных типов живёт в кабинете: своей формы правки у них в
        // приложении нет, и делать её ради трёх полей пока не просили.
        setStage({ kind: 'error', message: 'Эту записку правят в личном кабинете.' });
        return;
      }

      // Ответ из черновика: приложение могло перезагрузиться на полуслове, и
      // набранный ответ пропадать не должен. Значения самой записки берём из
      // карточки, а не из черновика — они уже сохранены в документе.
      const savedReply =
        typeof form.draft?.data.reply === 'string' ? form.draft.data.reply : '';

      setStage({
        kind: 'edit',
        form,
        initial: { kind: 'extra_expenses', values: extraValuesFromCard(memo) },
        memoId: memo.id,
        note,
        savedReply,
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

        // Записка из адреса: бот кладёт её номер в кнопки «Подробнее»
        // согласующему и «Открыть записку» автору. Если он есть — человек
        // пришёл к конкретной записке, и предлагать ему создать новую значит
        // потерять то, зачем он нажал кнопку.
        const wanted = new URLSearchParams(window.location.search).get('memo');
        if (wanted) {
          // Поля типа нужны карточке, чтобы нарисовать доп. поля подписями с
          // сервера, а не зашитыми здесь.
          const card = await tgApi.memo(wanted);
          const typed = await tgApi.form(card.memoType as TgMemoType);
          setStage({ kind: 'card', memoId: wanted, fields: typed.fields });
          return;
        }

        // Формы спрашиваем без типа: на этом шаге нужен только черновик, а он
        // один на человека и знает свой тип сам.
        const form = await tgApi.form();
        setFiles(form.attachments);
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
    stage.kind === 'form' || stage.kind === 'edit'
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
                setFiles([]);
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
          files={files}
          onFilesChanged={setFiles}
          maxFiles={stage.form.options.maxAttachments}
          initial={
            stage.initial?.kind === 'absence' ? stage.initial.values : null
          }
          onSent={(memo) => setStage({ kind: 'sent', ...memo })}
        />
      )}

      {stage.kind === 'form' && stage.form.memoType === 'extra_expenses' && (
        <ExtraExpenseForm
          form={stage.form}
          files={files}
          onFilesChanged={setFiles}
          maxFiles={stage.form.options.maxAttachments}
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
          files={files}
          onFilesChanged={setFiles}
          maxFiles={stage.form.options.maxAttachments}
          initial={
            stage.initial?.kind === 'expedited_invoice'
              ? stage.initial.values
              : null
          }
          onSent={(memo) => setStage({ kind: 'sent', ...memo })}
        />
      )}

      {stage.kind === 'form' && stage.form.memoType === 'other' && (
        <OtherForm
          files={files}
          onFilesChanged={setFiles}
          maxFiles={stage.form.options.maxAttachments}
          initial={stage.initial?.kind === 'other' ? stage.initial.values : null}
          onSent={(memo) => setStage({ kind: 'sent', ...memo })}
        />
      )}

      {stage.kind === 'card' && (
        <MemoCardScreen
          memoId={stage.memoId}
          fields={stage.fields}
          onEdit={() => {
            void (async () => {
              const card = await tgApi.memo(stage.memoId);
              await openEdit(card);
            })();
          }}
          onClosed={(outcome) => setStage({ kind: 'decided', outcome })}
        />
      )}

      {stage.kind === 'edit' && stage.initial.kind === 'extra_expenses' && (
        <ExtraExpenseForm
          form={stage.form}
          files={files}
          onFilesChanged={setFiles}
          maxFiles={stage.form.options.maxAttachments}
          initial={stage.initial.values}
          edit={{
            memoId: stage.memoId,
            note: stage.note,
            savedReply: stage.savedReply,
          }}
          onSent={(memo) => setStage({ kind: 'sent', ...memo })}
        />
      )}

      {stage.kind === 'decided' && (
        <div className="tg-card space-y-2">
          <p className="text-sm font-medium">
            {stage.outcome === 'final_approved'
              ? '✅ Записка утверждена — это был последний этап.'
              : stage.outcome === 'approve'
                ? '✅ Согласовано. Записка ушла на следующий этап.'
                : stage.outcome === 'reject'
                  ? '❌ Отклонено. Автору сообщили.'
                  : '✏️ Возвращено на доработку. Автору сообщили.'}
          </p>
          <button className="tg-button" onClick={close}>
            Закрыть
          </button>
        </div>
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
  if (memoType === 'other') {
    return { kind: 'other', values: otherValuesFromDraft(data) };
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
  if (started.kind === 'other') return otherHasAnything(started.values);
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
