import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tgApi } from './tgApi';
import AttachmentsField from './AttachmentsField';
import type { TgAttachment, TgForm } from './tgApi';
import { mainButton } from './telegram';

/** Задержка перед сохранением черновика: раз в полторы секунды после правки. */
const SAVE_DELAY_MS = 1500;

export interface AbsenceValues {
  reason: string;
  reasonOther: string;
  dateFrom: string;
  dateTo: string;
  comment: string;
}

const EMPTY: AbsenceValues = {
  reason: '',
  reasonOther: '',
  dateFrom: '',
  dateTo: '',
  comment: '',
};

/** Поля, которые форма рисует сама; остальное берётся из описания с сервера. */
const OWN_KEYS = new Set(['reason', 'reasonOther', 'dateFrom', 'dateTo']);

/**
 * Форма записки об отсутствии.
 *
 * Поля приходят с сервера описанием, а не зашиты здесь: так новое поле не
 * потребует правки приложения. Причина — выпадающим списком: в WebView он
 * открывает родной выбор платформы, и промахнуться мимо пункта невозможно.
 */
export default function AbsenceForm({
  form,
  initial,
  files,
  onFilesChanged,
  maxFiles,
  onSent,
}: {
  form: TgForm;
  /** Черновик, если человек решил продолжить. */
  initial: AbsenceValues | null;
  files: TgAttachment[];
  onFilesChanged: (files: TgAttachment[]) => void;
  maxFiles: number;
  onSent: (memo: { number: string; title: string }) => void;
}) {
  const [values, setValues] = useState<AbsenceValues>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const reasonField = form.fields.find((f) => f.key === 'reason');
  const otherField = form.fields.find((f) => f.key === 'reasonOther');
  const needsOwnReason = values.reason === 'other';

  const set = (patch: Partial<AbsenceValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  // ── Черновик ──
  // Сохраняем с задержкой: иначе запрос уходил бы на каждое нажатие клавиши.
  const saveTimer = useRef<number | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      // Сбой сохранения черновика не должен мешать заполнению: человек просто
      // потеряет возможность продолжить, а не текущую работу.
      void tgApi.saveDraft(toDraft(values)).catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [values]);

  /** Чего не хватает. Проверяет и сервер — здесь только чтобы не отправлять зря. */
  const problem = useMemo(() => {
    if (!values.reason) return 'Выберите причину';
    if (needsOwnReason && values.reasonOther.trim().length < 2)
      return 'Опишите причину';
    if (!values.dateFrom) return 'Укажите, с какого дня';
    if (!values.dateTo) return 'Укажите, по какой день';
    // Порядок дат проверяем здесь, потому что ограничения выбора даты в
    // WebView соблюдаются ненадёжно.
    if (values.dateTo < values.dateFrom) return 'Последний день раньше первого';
    return null;
  }, [values, needsOwnReason]);

  const submit = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const created = await tgApi.create({
        reason: values.reason,
        reasonOther: needsOwnReason ? values.reasonOther.trim() : undefined,
        dateFrom: values.dateFrom,
        dateTo: values.dateTo,
        comment: values.comment.trim() || undefined,
      });
      onSent(created);
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }, [values, needsOwnReason, onSent]);

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
    // Снимать обработчик обязательно: кнопка одна на всё приложение со стороны
    // Telegram, и забытый обработчик сработал бы уже на другом экране.
    return () => {
      button.offClick(click);
      button.hideProgress();
    };
  }, [problem, sending, submit]);

  return (
    <div className="space-y-4">
      <Field label={reasonField?.label ?? 'Причина отсутствия'} required>
        <select
          className="tg-input"
          value={values.reason}
          onChange={(e) => set({ reason: e.target.value })}
        >
          <option value="">— выберите —</option>
          {(reasonField?.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Своя причина спрашивается только при «Иное» — иначе поле лишнее. */}
      {needsOwnReason && (
        <Field
          label={otherField?.label ?? 'Причина своими словами'}
          required
          hint={otherField?.hint}
        >
          <input
            className="tg-input"
            value={values.reasonOther}
            onChange={(e) => set({ reasonOther: e.target.value })}
            maxLength={otherField?.maxLength ?? 200}
            placeholder="Коротко"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="С какого дня" required>
          <input
            className="tg-input"
            type="date"
            value={values.dateFrom}
            onChange={(e) =>
              // Сдвигаем конец за начало: так в большинстве случаев второе поле
              // заполнять не придётся вовсе.
              set({
                dateFrom: e.target.value,
                dateTo:
                  !values.dateTo || values.dateTo < e.target.value
                    ? e.target.value
                    : values.dateTo,
              })
            }
          />
        </Field>
        <Field label="По какой день" required>
          <input
            className="tg-input"
            type="date"
            value={values.dateTo}
            min={values.dateFrom || undefined}
            onChange={(e) => set({ dateTo: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Комментарий" hint="Что важно знать согласующим">
        <textarea
          className="tg-input min-h-[88px]"
          value={values.comment}
          onChange={(e) => set({ comment: e.target.value })}
          maxLength={1000}
          placeholder="Коротко, суть отсутствия"
        />
      </Field>

      {/* Поля, которых форма не знает: появятся, если на сервере добавят новое. */}
      {form.fields
        .filter((f) => !OWN_KEYS.has(f.key))
        .map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <input
              className="tg-input"
              disabled
              placeholder="Заполняется в кабинете"
            />
          </Field>
        ))}

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

/** Значения формы — в простой объект для сохранения черновика. */
function toDraft(values: AbsenceValues): Record<string, string> {
  return {
    reason: values.reason,
    reasonOther: values.reasonOther,
    dateFrom: values.dateFrom,
    dateTo: values.dateTo,
    comment: values.comment,
  };
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
