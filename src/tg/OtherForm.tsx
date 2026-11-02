import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tgApi } from './tgApi';
import AttachmentsField from './AttachmentsField';
import type { TgAttachment, TgDraftData } from './tgApi';
import { mainButton } from './telegram';

/** Задержка перед сохранением черновика: раз в полторы секунды после правки. */
const SAVE_DELAY_MS = 1500;

/** Пределы те же, что у DTO отправки: колонки записки varchar(300) и text. */
const MAX_TITLE = 300;
const MAX_TEXT = 5000;

export interface OtherValues {
  title: string;
  text: string;
}

export const EMPTY_OTHER: OtherValues = { title: '', text: '' };

/** Черновик с сервера — в значения формы. Неизвестные ключи отбрасываем. */
export function otherValuesFromDraft(data: TgDraftData): OtherValues {
  const text = (key: string): string => {
    const raw = data[key];
    return typeof raw === 'string' ? raw : '';
  };
  return { title: text('title'), text: text('text') };
}

/** Есть ли в черновике хоть что-то. Пустой предлагать продолжать незачем. */
export function otherHasAnything(values: OtherValues): boolean {
  return values.title.trim() !== '' || values.text.trim() !== '';
}

/**
 * Форма прочей записки («Иное»).
 *
 * Поля не берутся из описания с сервера, как у остальных типов: у «Иного» их
 * там нет вовсе — тема и текст это общие колонки записки, а не payload. То,
 * что список полей типа остаётся пустым, держит тест `memos.config.spec.ts`:
 * если однажды поле добавят, он упадёт, и об этом узнают сразу, а не по
 * молча не доходящему до сервера значению.
 */
export default function OtherForm({
  initial,
  files,
  onFilesChanged,
  maxFiles,
  onSent,
}: {
  /** Черновик, если человек решил продолжить. */
  initial: OtherValues | null;
  files: TgAttachment[];
  onFilesChanged: (files: TgAttachment[]) => void;
  maxFiles: number;
  onSent: (memo: { number: string; title: string }) => void;
}) {
  const [values, setValues] = useState<OtherValues>(initial ?? EMPTY_OTHER);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const set = (patch: Partial<OtherValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  // ── Черновик ──
  const saveTimer = useRef<number | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      // Сбой сохранения черновика не должен мешать заполнению.
      void tgApi
        .saveDraft({ ...values, memoType: 'other' })
        .catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [values]);

  /** Чего не хватает. Те же пределы, что на сервере — чтобы не отправлять зря. */
  const problem = useMemo(() => {
    if (values.title.trim().length < 3) return 'Укажите тему записки';
    if (values.text.trim().length < 5) return 'Напишите текст записки';
    return null;
  }, [values]);

  const submit = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const created = await tgApi.createOther({
        title: values.title.trim(),
        text: values.text.trim(),
      });
      onSent(created);
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }, [values, onSent]);

  // ── Нижняя кнопка Telegram ──
  useEffect(() => {
    const button = mainButton();
    if (!button) return;

    button.setText('Отправить на согласование');
    button.show();
    if (problem || sending) button.disable();
    else button.enable();
    if (sending) button.showProgress(false);
    else button.hideProgress();

    const click = () => {
      if (!problem && !sending) void submit();
    };
    button.onClick(click);
    // Обработчик снимаем обязательно: кнопка одна на всё приложение, и забытый
    // обработчик сработал бы уже на другом экране.
    return () => {
      button.offClick(click);
      button.hideProgress();
    };
  }, [problem, sending, submit]);

  return (
    <div className="space-y-4">
      <Field
        label="Тема записки"
        required
        hint="Коротко, о чём речь — эту строку согласующий видит в списке"
      >
        <input
          className="tg-input"
          value={values.title}
          onChange={(e) => set({ title: e.target.value })}
          maxLength={MAX_TITLE}
          placeholder="Пропуск на территорию склада"
        />
      </Field>

      <Field
        label="Текст записки"
        required
        hint="Что нужно и почему. Если речь о деньгах — назовите сумму здесь же"
      >
        <textarea
          className="tg-input min-h-[160px]"
          value={values.text}
          onChange={(e) => set({ text: e.target.value })}
          maxLength={MAX_TEXT}
          placeholder="Прошу оформить постоянный пропуск для водителя…"
        />
      </Field>

      <AttachmentsField
        files={files}
        onChanged={onFilesChanged}
        max={maxFiles}
      />

      {error && <div className="tg-error">{error}</div>}
      {problem && !error && <div className="tg-hint-text">{problem}</div>}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="tg-hint-text block">{hint}</span>}
    </label>
  );
}
