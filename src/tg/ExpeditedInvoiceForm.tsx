import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tgApi } from './tgApi';
import AttachmentsField from './AttachmentsField';
import type { TgAttachment, TgDraftData, TgFieldDef, TgForm } from './tgApi';
import { mainButton } from './telegram';

/** Задержка перед сохранением черновика: раз в полторы секунды после правки. */
const SAVE_DELAY_MS = 1500;

/** Деньги вводят и с запятой, и с пробелами — принимаем оба написания. */
const MONEY = /^\d{0,15}([.,]\d{0,2})?$/;

export interface InvoiceValues {
  orderNumber: string;
  counterpartyName: string;
  amount: string;
  currency: string;
  reason: string;
  /** «ГГГГ-ММ-ДДTЧЧ:ММ» — ровно то, что отдаёт datetime-local. */
  documentsExpectedAt: string;
}

export const emptyInvoice = (currency: string): InvoiceValues => ({
  orderNumber: '',
  counterpartyName: '',
  amount: '',
  currency,
  reason: '',
  documentsExpectedAt: '',
});

/** Черновик с сервера — в значения формы. Неизвестные ключи отбрасываем. */
export function invoiceValuesFromDraft(
  data: TgDraftData,
  currency: string,
): InvoiceValues {
  const text = (key: string): string => {
    const raw = data[key];
    return typeof raw === 'string' ? raw : '';
  };
  return {
    orderNumber: text('orderNumber'),
    counterpartyName: text('counterpartyName'),
    amount: text('amount'),
    currency: text('currency') || currency,
    reason: text('reason'),
    documentsExpectedAt: text('documentsExpectedAt'),
  };
}

/** Есть ли в черновике хоть что-то. Пустой предлагать продолжать незачем. */
export function invoiceHasAnything(values: InvoiceValues): boolean {
  return [
    values.orderNumber,
    values.counterpartyName,
    values.amount,
    values.reason,
    values.documentsExpectedAt,
  ].some((v) => v.trim() !== '');
}

/**
 * Форма ускоренного выставления счёта (АВР).
 *
 * Поля перевозки, контрагента и срока документов рисуются **по описанию с
 * сервера**, а не перечислены здесь: у этого типа они плоские, и новое поле не
 * потребует правки приложения. Сумма, валюта и причина — своими руками: сумма
 * живёт не в payload, а в колонке записки, а причина уходит в обоснование.
 */
export default function ExpeditedInvoiceForm({
  form,
  initial,
  files,
  onFilesChanged,
  maxFiles,
  onSent,
}: {
  form: TgForm;
  /** Черновик, если человек решил продолжить. */
  initial: InvoiceValues | null;
  files: TgAttachment[];
  onFilesChanged: (files: TgAttachment[]) => void;
  maxFiles: number;
  onSent: (memo: { number: string; title: string }) => void;
}) {
  const [values, setValues] = useState<InvoiceValues>(
    () => initial ?? emptyInvoice(form.options.currencies[0] ?? 'UZS'),
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const set = (patch: Partial<InvoiceValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  const fieldOf = (key: string): TgFieldDef | undefined =>
    form.fields.find((f) => f.key === key);
  const orderField = fieldOf('orderNumber');
  const partyField = fieldOf('counterpartyName');
  const expectedField = fieldOf('documentsExpectedAt');

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
        .saveDraft({ ...values, memoType: 'expedited_invoice' })
        .catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [values]);

  /** Чего не хватает. Проверяет и сервер — здесь только чтобы не отправлять зря. */
  const problem = useMemo(() => {
    if (!values.orderNumber.trim()) return 'Укажите номер перевозки';
    if (values.counterpartyName.trim().length < 2)
      return 'Укажите имя контрагента';
    if (!MONEY.test(values.amount)) return 'Сумма вводится числом';
    if (!values.amount.trim() || toNumber(values.amount) <= 0)
      return 'Укажите выставляемую сумму';
    if (values.reason.trim().length < 5)
      return 'Опишите причину ускоренного выставления';
    if (!values.documentsExpectedAt) return 'Укажите, когда ждёте документы';
    // Срок в прошлом — опечатка: по нему согласующий не поймёт, когда ждать
    // документы. Сравниваем по дню: записку нередко дописывают вечером.
    if (values.documentsExpectedAt.slice(0, 10) < today())
      return 'Этот срок уже прошёл';
    return null;
  }, [values]);

  const submit = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const created = await tgApi.createExpeditedInvoice({
        orderNumber: values.orderNumber.trim(),
        counterpartyName: values.counterpartyName.trim(),
        amount: toNumber(values.amount),
        currency: values.currency,
        reason: values.reason.trim(),
        documentsExpectedAt: values.documentsExpectedAt,
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
        label={orderField?.label ?? 'Номер перевозки'}
        required
        hint={orderField?.hint}
      >
        <input
          className="tg-input"
          value={values.orderNumber}
          onChange={(e) => set({ orderNumber: e.target.value })}
          maxLength={orderField?.maxLength ?? 50}
          placeholder="RUUZ-00191"
        />
      </Field>

      <Field
        label={partyField?.label ?? 'Имя контрагента'}
        required
        hint={partyField?.hint}
      >
        <input
          className="tg-input"
          value={values.counterpartyName}
          onChange={(e) => set({ counterpartyName: e.target.value })}
          maxLength={partyField?.maxLength ?? 300}
          placeholder="Название из договора"
        />
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Выставляемая сумма" required>
          <input
            className="tg-input"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set({ amount: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field label="Валюта" required>
          <select
            className="tg-input"
            value={values.currency}
            onChange={(e) => set({ currency: e.target.value })}
          >
            {form.options.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Причина ускоренного выставления"
        required
        hint="Почему счёт нужен раньше документов — например: не получили документы от подрядчика"
      >
        <textarea
          className="tg-input min-h-[96px]"
          value={values.reason}
          onChange={(e) => set({ reason: e.target.value })}
          maxLength={1000}
          placeholder="Не получили документы от подрядчика, клиент ждёт счёт"
        />
      </Field>

      <Field
        label={expectedField?.label ?? 'Когда ждём документы'}
        required
        hint={
          expectedField?.hint ?? 'Планируемые дата и время получения документов'
        }
      >
        <input
          className="tg-input"
          type="datetime-local"
          value={values.documentsExpectedAt}
          min={`${today()}T00:00`}
          onChange={(e) => set({ documentsExpectedAt: e.target.value })}
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

/** Поля, которые форма рисует сама; остальное берётся из описания с сервера. */
const OWN_KEYS = new Set([
  'orderNumber',
  'counterpartyName',
  'documentsExpectedAt',
]);

/** Сегодняшний день строкой — тем же форматом, что и поле ввода. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Деньги в число. Непонятное считаем нулём — о нём скажет проверка. */
function toNumber(raw: string): number {
  const text = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number(text);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
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
