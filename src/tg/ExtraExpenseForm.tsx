import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tgApi } from './tgApi';
import AttachmentsField from './AttachmentsField';
import type { TgAttachment, TgDraftData, TgEmployee, TgForm } from './tgApi';
import { mainButton } from './telegram';

/** Задержка перед сохранением черновика: раз в полторы секунды после правки. */
const SAVE_DELAY_MS = 1500;

/** Задержка перед запросом подсказок: пока человек печатает, сервер не дёргаем. */
const SUGGEST_DELAY_MS = 300;

export interface ExpenseRow {
  /** Ключ строки для React. На сервер не уходит. */
  id: string;
  expenseType: string;
  /** Кому платим — свободный текст, по решению заказчика без справочника. */
  counterpartyName: string;
  planned: string;
  actual: string;
}

export interface ExtraExpenseValues {
  orderNumber: string;
  /** Тип перевозки: от него зависит, кому записка уйдёт на согласование. */
  transportationTypeId: string;
  currency: string;
  lines: ExpenseRow[];
  incomePlanned: string;
  incomeActual: string;
  reason: string;
  rebilled: string;
  /** contractor | own — кто несёт расход, если клиенту он не перевыставлен. */
  expenseBearer: string;
  contractorClaim: string;
  /** Отдел спрашиваем, только если у выбранного сотрудника он не проставлен. */
  responsibleDepartmentId: string;
  /** Кого выбрали: ссылка, имя и его отдел — последние два для показа. */
  responsibleEmployeeId: string;
  responsiblePerson: string;
  responsibleDepartmentName: string;
}

/** Деньги вводят и с запятой, и с пробелами — принимаем оба написания. */
const MONEY = /^\d{0,15}([.,]\d{0,2})?$/;

let rowSeq = 0;
const newRow = (): ExpenseRow => ({
  id: `r${(rowSeq += 1)}`,
  expenseType: '',
  counterpartyName: '',
  planned: '',
  actual: '',
});

/**
 * Черновик с сервера — в значения формы.
 *
 * Ключи строк выдаём заново: в черновике их нет, они нужны только React, а
 * без них React перепутал бы строки при удалении из середины таблицы.
 */
export function extraValuesFromDraft(
  data: TgDraftData,
  currency: string,
): ExtraExpenseValues {
  const text = (key: string): string => {
    const raw = data[key];
    return typeof raw === 'string' ? raw : '';
  };
  const raw = data.lines;
  const lines = Array.isArray(raw)
    ? raw.map((l) => ({
        ...newRow(),
        expenseType: l.expenseType,
        planned: l.planned,
        actual: l.actual,
      }))
    : [];

  return {
    orderNumber: text('orderNumber'),
    transportationTypeId: text('transportationTypeId'),
    currency: text('currency') || currency,
    lines: lines.length ? lines : [newRow()],
    incomePlanned: text('incomePlanned'),
    incomeActual: text('incomeActual'),
    reason: text('reason'),
    rebilled: text('rebilled'),
    expenseBearer: text('expenseBearer'),
    contractorClaim: text('contractorClaim'),
    responsibleDepartmentId: text('responsibleDepartmentId'),
    responsibleEmployeeId: text('responsibleEmployeeId'),
    responsiblePerson: text('responsiblePerson'),
    responsibleDepartmentName: text('responsibleDepartmentName'),
  };
}

/** Есть ли в черновике хоть что-то. Пустой предлагать продолжать незачем. */
export function extraHasAnything(values: ExtraExpenseValues): boolean {
  if (values.orderNumber.trim() || values.reason.trim() || values.rebilled)
    return true;
  if (values.incomePlanned.trim() || values.incomeActual.trim()) return true;
  return values.lines.some((l) => !isBlank(l));
}

export const emptyExtraExpense = (currency: string): ExtraExpenseValues => ({
  orderNumber: '',
  transportationTypeId: '',
  currency,
  lines: [newRow()],
  incomePlanned: '',
  incomeActual: '',
  reason: '',
  rebilled: '',
  expenseBearer: '',
  contractorClaim: '',
  responsibleDepartmentId: '',
  responsibleEmployeeId: '',
  responsiblePerson: '',
  responsibleDepartmentName: '',
});

/**
 * Форма обоснования доп. расходов.
 *
 * Таблица на телефоне — карточка на строку, а не `<table>`: четыре колонки в
 * 360 точках превращаются в нечитаемую сетку, а поля денег становятся уже
 * пальца.
 *
 * Итоги считаются **целыми копейками**: на сложении чисел с плавающей точкой
 * человек увидел бы `0.30000000000000004` прямо на экране. Окончательный счёт
 * всё равно за сервером — там `Decimal`, здесь только подсказка по ходу.
 */
export default function ExtraExpenseForm({
  form,
  initial,
  files,
  onFilesChanged,
  maxFiles,
  onSent,
}: {
  form: TgForm;
  /** Черновик, если человек решил продолжить. */
  initial: ExtraExpenseValues | null;
  files: TgAttachment[];
  onFilesChanged: (files: TgAttachment[]) => void;
  maxFiles: number;
  onSent: (memo: { number: string; title: string }) => void;
}) {
  const [values, setValues] = useState<ExtraExpenseValues>(
    () => initial ?? emptyExtraExpense(form.options.currencies[0] ?? 'UZS'),
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const set = (patch: Partial<ExtraExpenseValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  const setLine = (id: string, patch: Partial<ExpenseRow>) =>
    setValues((v) => ({
      ...v,
      lines: v.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));

  const addLine = () =>
    setValues((v) =>
      v.lines.length >= form.options.maxExpenseLines
        ? v
        : { ...v, lines: [...v.lines, newRow()] },
    );

  const dropLine = (id: string) =>
    setValues((v) => ({ ...v, lines: v.lines.filter((l) => l.id !== id) }));

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
      void tgApi.saveDraft(toDraft(values)).catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [values]);

  // ── Итоги по ходу заполнения ──
  const totals = useMemo(() => {
    let planned = 0;
    let actual = 0;
    for (const line of values.lines) {
      planned += toCents(line.planned);
      actual += toCents(line.actual);
    }
    return { planned, actual, overrun: actual - planned };
  }, [values.lines]);

  const incomeDiff =
    toCents(values.incomeActual) - toCents(values.incomePlanned);
  // Кто несёт расход спрашиваем и при «частично»: часть расхода осталась на
  // нас, и на неё вопрос осмыслен.
  const needsBearer = values.rebilled === 'no' || values.rebilled === 'partial';
  const byContractor = needsBearer && values.expenseBearer === 'contractor';
  const byUs = needsBearer && values.expenseBearer === 'own';
  /** Строки, которые человек хоть как-то тронул. Пустые в счёт не идут. */
  const filled = values.lines.filter((l) => !isBlank(l));

  /** Чего не хватает. Проверяет и сервер — здесь только чтобы не отправлять зря. */
  const problem = useMemo(() => {
    if (!values.orderNumber.trim()) return 'Укажите номер перевозки';
    if (!values.transportationTypeId) return 'Выберите тип перевозки';
    if (!filled.length) return 'Добавьте хотя бы одну строку расходов';
    if (filled.some((l) => l.expenseType.trim().length < 2))
      return 'Укажите вид расхода в каждой строке';
    if (
      values.lines.some((l) => !MONEY.test(l.planned) || !MONEY.test(l.actual))
    )
      return 'Суммы расходов вводятся числами';
    if (!MONEY.test(values.incomePlanned) || !MONEY.test(values.incomeActual))
      return 'Суммы дохода вводятся числами';
    if (!values.incomePlanned.trim() || !values.incomeActual.trim())
      return 'Укажите планируемый и фактический доход';
    if (values.reason.trim().length < 5) return 'Опишите причину перерасхода';
    if (!values.rebilled) return 'Ответьте, перевыставлен ли расход клиенту';
    if (needsBearer && !values.expenseBearer)
      return 'Ответьте, кто несёт расход';
    if (byContractor && values.contractorClaim.trim().length < 2)
      return 'Укажите, на каком основании предъявляем подрядчику';
    if (byUs && !values.responsibleDepartmentId)
      return 'Выберите отдел ответственности';
    if (byUs && !values.responsibleEmployeeId)
      return 'Выберите, в зоне ответственности кого возник расход';
    // Отдел спрашиваем только у того, кому его ещё не проставили.
    if (
      byUs &&
      !values.responsibleDepartmentName &&
      !values.responsibleDepartmentId
    )
      return 'У сотрудника не указан отдел — выберите его';
    return null;
  }, [values, filled, needsBearer, byContractor, byUs]);

  const submit = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const created = await tgApi.createExtraExpenses({
        orderNumber: values.orderNumber.trim(),
        transportationTypeId: values.transportationTypeId,
        currency: values.currency,
        lines: values.lines
          .filter((l) => !isBlank(l))
          .map((l) => ({
            expenseType: l.expenseType.trim(),
            counterpartyName: l.counterpartyName.trim(),
            planned: toCents(l.planned) / 100,
            actual: toCents(l.actual) / 100,
          })),
        incomePlanned: toCents(values.incomePlanned) / 100,
        incomeActual: toCents(values.incomeActual) / 100,
        reason: values.reason.trim(),
        rebilled: values.rebilled,
        // Отправляем только то, что спрашивали: иначе в базе остался бы ответ
        // на вопрос, которого не задавали. Сервер это всё равно перепроверит.
        expenseBearer: needsBearer ? values.expenseBearer : undefined,
        contractorClaim: byContractor
          ? values.contractorClaim.trim()
          : undefined,
        responsibleEmployeeId: byUs ? values.responsibleEmployeeId : undefined,
        // Отдел шлём только когда у сотрудника его нет: иначе сервер всё равно
        // возьмёт отдел из профиля, а не присланный.
        responsibleDepartmentId:
          byUs && !values.responsibleDepartmentName
            ? values.responsibleDepartmentId
            : undefined,
      });
      onSent(created);
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }, [values, needsBearer, byContractor, byUs, onSent]);

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
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Номер перевозки" required hint="Как он записан в заявке">
          <input
            className="tg-input"
            value={values.orderNumber}
            onChange={(e) => set({ orderNumber: e.target.value })}
            maxLength={50}
            placeholder="25-001234"
          />
        </Field>
        <Field
          label="Тип перевозки"
          required
          hint="От него зависит, кто согласует"
        >
          <select
            className="tg-input"
            value={values.transportationTypeId}
            onChange={(e) => set({ transportationTypeId: e.target.value })}
          >
            <option value="">— выберите —</option>
            {form.options.transportationTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
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

      {/* ── Таблица расходов ── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Расходы по перевозке<span className="text-red-500"> *</span>
        </p>
        {values.lines.map((line, i) => {
          const diff = toCents(line.actual) - toCents(line.planned);
          return (
            <div key={line.id} className="tg-card space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className="tg-input"
                  value={line.expenseType}
                  onChange={(e) =>
                    setLine(line.id, { expenseType: e.target.value })
                  }
                  maxLength={200}
                  placeholder={`Вид расхода №${i + 1}`}
                />
                {/* Удаление скрыто, когда строка одна: пустая таблица всё равно
                    не отправится, а кнопка только путала бы. */}
                {values.lines.length > 1 && (
                  <button
                    type="button"
                    className="tg-icon-button"
                    onClick={() => dropLine(line.id)}
                    aria-label="Удалить строку"
                  >
                    ✕
                  </button>
                )}
              </div>
              <input
                className="tg-input"
                value={line.counterpartyName}
                onChange={(e) =>
                  setLine(line.id, { counterpartyName: e.target.value })
                }
                maxLength={300}
                placeholder="Кому платим"
              />

              <div className="grid grid-cols-2 gap-2">
                <Money
                  label="План"
                  value={line.planned}
                  onChange={(v) => setLine(line.id, { planned: v })}
                />
                <Money
                  label="Факт"
                  value={line.actual}
                  onChange={(v) => setLine(line.id, { actual: v })}
                />
              </div>
              <p className="tg-hint-text">
                Разница: <span className={diffClass(diff)}>{signed(diff)}</span>
              </p>
            </div>
          );
        })}

        {values.lines.length < form.options.maxExpenseLines ? (
          <button type="button" className="tg-add-row" onClick={addLine}>
            + Добавить строку
          </button>
        ) : (
          <p className="tg-hint-text">
            Больше {form.options.maxExpenseLines} строк в одной записке не
            поместится.
          </p>
        )}
      </div>

      {/* ── Итоги ── */}
      <div className="tg-card space-y-1.5">
        <Total label="Расходы по плану" value={fromCents(totals.planned)} />
        <Total label="Расходы по факту" value={fromCents(totals.actual)} />
        <div className="flex items-baseline justify-between pt-1.5 border-t border-black/10">
          <span className="text-sm font-medium">
            {totals.overrun < 0 ? 'Экономия' : 'Превышение'}
          </span>
          <span
            className={`text-base font-semibold ${diffClass(totals.overrun)}`}
          >
            {signed(totals.overrun)} {values.currency}
          </span>
        </div>
      </div>

      {/* ── Доход ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Планируемый доход" required>
          <input
            className="tg-input"
            inputMode="decimal"
            value={values.incomePlanned}
            onChange={(e) => set({ incomePlanned: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field label="Фактический доход" required>
          <input
            className="tg-input"
            inputMode="decimal"
            value={values.incomeActual}
            onChange={(e) => set({ incomeActual: e.target.value })}
            placeholder="0"
          />
        </Field>
      </div>
      <p className="tg-hint-text -mt-2">
        Разница по доходу:{' '}
        <span className={diffClass(incomeDiff, true)}>
          {signed(incomeDiff)}
        </span>{' '}
        {values.currency}
      </p>

      {/* ── Три ответа про превышение ── */}
      <Field
        label="Причина перерасхода"
        required
        hint="Почему расходы вышли за план: что произошло, где и из-за кого"
      >
        <textarea
          className="tg-input min-h-[96px]"
          value={values.reason}
          onChange={(e) => set({ reason: e.target.value })}
          maxLength={5000}
          placeholder="Простой на границе четыре дня из-за очереди"
        />
      </Field>

      <Field label="Расход перевыставлен клиенту?" required>
        <select
          className="tg-input"
          value={values.rebilled}
          onChange={(e) => set({ rebilled: e.target.value })}
        >
          <option value="">— выберите —</option>
          {form.options.rebilled.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Кто несёт расход спрашиваем только там, где он лёг не на клиента. */}
      {needsBearer && (
        <Field label="Кто несёт расход?" required>
          <select
            className="tg-input"
            value={values.expenseBearer}
            onChange={(e) => set({ expenseBearer: e.target.value })}
          >
            <option value="">— выберите —</option>
            {form.options.expenseBearers.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {byContractor && (
        <Field
          label="На каком основании предъявляем подрядчику"
          required
          hint="Чтобы бухгалтерия не ходила переспрашивать: что нарушено и чем подтверждается"
        >
          <textarea
            className="tg-input min-h-[88px]"
            value={values.contractorClaim}
            onChange={(e) => set({ contractorClaim: e.target.value })}
            maxLength={1000}
            placeholder="Простой по вине перевозчика, претензия по п. 4.2 договора"
          />
        </Field>
      )}

      {byUs && (
        <>
          <Field
            label="В зоне ответственности кого возник расход"
            required
            hint={
              values.responsibleDepartmentName
                ? `Отдел: ${values.responsibleDepartmentName}`
                : 'Начните набирать фамилию'
            }
          >
            <EmployeeField
              value={values.responsiblePerson}
              onType={(v) =>
                // Правят имя руками — значит выбранный сотрудник больше не он,
                // и ссылку с отделом надо снять.
                set({
                  responsiblePerson: v,
                  responsibleEmployeeId: '',
                  responsibleDepartmentName: '',
                })
              }
              onPick={(found) =>
                set({
                  responsiblePerson: found.name,
                  responsibleEmployeeId: found.id,
                  responsibleDepartmentName: found.department?.name ?? '',
                  responsibleDepartmentId: '',
                })
              }
            />
          </Field>

          {/* Отдел спрашиваем, только если у выбранного он не проставлен:
              иначе записку нельзя было бы подать, пока админ не заполнит
              справочник. */}
          {values.responsibleEmployeeId &&
            !values.responsibleDepartmentName && (
              <Field
                label="Отдел ответственного"
                required
                hint="У сотрудника отдел не указан — выберите вручную или проставьте его в настройках записок"
              >
                <select
                  className="tg-input"
                  value={values.responsibleDepartmentId}
                  onChange={(e) =>
                    set({ responsibleDepartmentId: e.target.value })
                  }
                >
                  <option value="">— выберите —</option>
                  {form.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
        </>
      )}

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

/** Строка черновика: ключ строки наружу не уходит, он нужен только React. */
function toDraft(values: ExtraExpenseValues) {
  return {
    memoType: 'extra_expenses',
    orderNumber: values.orderNumber,
    transportationTypeId: values.transportationTypeId,
    currency: values.currency,
    lines: values.lines.map((l) => ({
      expenseType: l.expenseType,
      counterpartyName: l.counterpartyName,
      planned: l.planned,
      actual: l.actual,
    })),
    incomePlanned: values.incomePlanned,
    incomeActual: values.incomeActual,
    reason: values.reason,
    rebilled: values.rebilled,
    expenseBearer: values.expenseBearer,
    contractorClaim: values.contractorClaim,
    responsibleDepartmentId: values.responsibleDepartmentId,
    responsibleEmployeeId: values.responsibleEmployeeId,
    responsiblePerson: values.responsiblePerson,
    responsibleDepartmentName: values.responsibleDepartmentName,
  };
}

/** Строка, в которой человек ничего не написал. На сервер не отправляется. */
function isBlank(line: ExpenseRow): boolean {
  return (
    !line.expenseType.trim() && !line.planned.trim() && !line.actual.trim()
  );
}

/** Деньги в целые копейки. Непонятное считаем нулём — о нём скажет проверка. */
function toCents(raw: string): number {
  const text = raw.replace(/\s/g, '').replace(',', '.');
  if (!text) return 0;
  const value = Number(text);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function fromCents(cents: number): string {
  return (cents / 100).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Со знаком: по нему сразу видно перерасход это или экономия. */
function signed(cents: number): string {
  if (cents === 0) return fromCents(0);
  return `${cents > 0 ? '+' : '−'}${fromCents(Math.abs(cents))}`;
}

/**
 * Цвет разницы. У расходов рост — плохо, у дохода наоборот, поэтому цвет
 * зависит не только от знака.
 */
function diffClass(cents: number, higherIsBetter = false): string {
  if (cents === 0) return '';
  const bad = higherIsBetter ? cents < 0 : cents > 0;
  return bad ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium';
}

/**
 * «В зоне ответственности кого» — поиск по справочнику сотрудников.
 *
 * Здесь подсказки уместны, в отличие от «кому платим»: справочник закрытый и
 * полный — семьсот человек из 1С, — и выбор из него избавляет от «Иванова»,
 * «Иванова И.» и «иванов и.и.» как трёх разных людей. Поле всё же остаётся
 * текстовым: пока человека не выбрали, набранное видно на экране.
 *
 * Запрос уходит с задержкой и только от двух букв: иначе на каждое нажатие шёл
 * бы запрос, а по одной букве вернулся бы весь справочник.
 */
function EmployeeField({
  value,
  onType,
  onPick,
}: {
  value: string;
  onType: (value: string) => void;
  onPick: (employee: TgEmployee) => void;
}) {
  const [items, setItems] = useState<TgEmployee[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const asked = useRef('');

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const ask = (query: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(() => {
      asked.current = query;
      void tgApi
        .employees(query)
        .then((found) => {
          // Ответ на устаревший запрос выбрасываем: иначе список прыгал бы
          // назад к тому, что человек уже дописал.
          if (asked.current !== query) return;
          setItems(found);
          setOpen(found.length > 0);
        })
        .catch(() => {
          setItems([]);
          setOpen(false);
        });
    }, SUGGEST_DELAY_MS);
  };

  return (
    <div className="tg-suggest-wrap">
      <input
        className="tg-input"
        value={value}
        onChange={(e) => {
          onType(e.target.value);
          ask(e.target.value);
        }}
        onFocus={() => setOpen(items.length > 0)}
        // Закрываем с задержкой: без неё список исчезает раньше, чем успевает
        // сработать нажатие по подсказке.
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        maxLength={300}
        placeholder="Фамилия"
      />
      {open && (
        <ul className="tg-suggest">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="tg-suggest-item"
                // pointerDown, а не click: на телефоне поле теряет фокус
                // раньше, чем доходит нажатие, и выбор не срабатывал бы.
                onPointerDown={(e) => {
                  e.preventDefault();
                  onPick(item);
                  setOpen(false);
                }}
              >
                {item.name}
                {item.department && (
                  <span className="tg-hint-text">
                    {' '}
                    · {item.department.name}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="tg-hint-text">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function Money({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="tg-hint-text">{label}</span>
      <input
        className="tg-input"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </label>
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
