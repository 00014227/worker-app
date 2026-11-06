import { useCallback, useEffect, useState } from 'react';
import {
  DECISION,
  MEMO_STATUS,
  MEMO_TYPE,
  REBILLED_LABEL,
  EXPENSE_BEARER_LABEL,
  fmtDateTime,
  fmtMoney,
  fmtSize,
  fieldValue,
} from '@/components/memos/memo-meta';
import type { MemoCard } from '@/lib/api';
import { tgApi } from './tgApi';
import type { TgFieldDef, TgHistoryEntry } from './tgApi';
import { mainButton } from './telegram';
import MemoHistoryList from '@/components/memos/MemoHistoryList';

type Decision = 'approve' | 'reject' | 'return';

const BUTTONS: { kind: Decision; label: string; className: string }[] = [
  { kind: 'approve', label: '✅ Согласовать', className: 'tg-button' },
  {
    kind: 'return',
    label: '✏️ На доработку',
    className: 'tg-button-secondary',
  },
  { kind: 'reject', label: '❌ Отклонить', className: 'tg-button-secondary' },
];

/**
 * Карточка записки в Telegram — то, что открывается кнопкой «Подробнее».
 *
 * Состав тот же, что в кабинете: служба на сервере одна, и расхождение между
 * тем, что видит согласующий в чате и в кабинете, было бы поводом не доверять
 * ни тому, ни другому. Разметка своя, на `tg-*`: кабинетная вёрстка в Telegram
 * выглядит чужой.
 *
 * Поля типа рисуются по описанию с сервера, а не перечислены здесь, — так
 * новое поле не потребует правки приложения.
 */
export default function MemoCardScreen({
  memoId,
  fields,
  onEdit,
  onClosed,
}: {
  memoId: string;
  /** Описание полей типа. Приходит тем же `form`, что и у создания. */
  fields: TgFieldDef[];
  /** Автор нажал «Исправить» — наверх, страница откроет правку. */
  onEdit: () => void;
  /** Решение принято: показать итог и убрать кнопки. */
  onClosed: (outcome: string) => void;
}) {
  const [memo, setMemo] = useState<MemoCard | null>(null);
  const [history, setHistory] = useState<TgHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Decision | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Двумя запросами параллельно: история нужна сразу, а не по нажатию —
      // последний согласующий открывает карточку именно ради неё.
      const [card, log] = await Promise.all([
        tgApi.memo(memoId),
        tgApi.history(memoId),
      ]);
      setMemo(card);
      setHistory(log);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [memoId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Нижняя кнопка Telegram принадлежит формам; на карточке решения стоят в
  // тексте, и чужая кнопка внизу сбивала бы с толку.
  useEffect(() => {
    mainButton()?.hide();
  }, []);

  const needsComment = kind === 'reject' || kind === 'return';
  const tooShort = needsComment && comment.trim().length < 3;

  const decide = async () => {
    if (!memo?.myTaskId || !kind || tooShort) return;
    setBusy(true);
    setError(null);
    try {
      const { outcome } = await tgApi.decide(
        memo.id,
        memo.myTaskId,
        kind,
        comment.trim() || undefined,
      );
      onClosed(outcome);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (error && !memo) return <div className="tg-error">{error}</div>;
  if (!memo) return <p className="tg-hint-text">Открываем…</p>;

  const status = MEMO_STATUS[memo.status];
  const extra = memo.extraExpense;
  // Поля с непустым значением: пустые строки в карточке только занимают место.
  const filled = fields.filter((f) => {
    const v = memo.payload[f.key];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });

  return (
    <div className="space-y-3">
      <div className="tg-card space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{memo.number ?? 'Черновик'}</span>
          <span className="tg-hint-text">· {status?.label ?? memo.status}</span>
        </div>
        <p className="text-sm">{memo.title}</p>
        <p className="tg-hint-text">
          {MEMO_TYPE[memo.memoType]?.short ?? memo.memoType} · {memo.authorName}
          {memo.department ? ` · ${memo.department.name}` : ''}
        </p>
        {/* У доп. расходов тип перевозки уже стоит в блоке таблицы, рядом с
            номером перевозки; второй раз его показывать незачем. */}
        {memo.transportationType && !extra && (
          <p className="tg-hint-text">
            перевозка: {memo.transportationType.name}
          </p>
        )}
        <p className="tg-hint-text">создана {fmtDateTime(memo.createdAt)}</p>
      </div>

      {(memo.amount || filled.length > 0 || memo.justification) && (
        <div className="tg-card space-y-2">
          {memo.amount && (
            <Line
              label={extra ? 'Превышение по расходам' : 'Сумма'}
              value={fmtMoney(memo.amount, memo.currency)}
            />
          )}
          {filled.map((f) => (
            <Line
              key={f.key}
              label={f.label}
              value={fieldValue(f, memo.payload[f.key])}
            />
          ))}
          {memo.justification && (
            <div className="space-y-0.5">
              <p className="tg-hint-text">
                {extra ? 'Причина перерасхода' : 'Обоснование'}
              </p>
              <p className="text-sm whitespace-pre-wrap break-words">
                {memo.justification}
              </p>
            </div>
          )}
        </div>
      )}

      {extra && (
        <div className="tg-card space-y-2">
          <p className="text-sm font-medium">Перевозка {extra.orderNumber}</p>
          {extra.transportationType && (
            <p className="tg-hint-text">{extra.transportationType.name}</p>
          )}
          <div className="space-y-1.5">
            {extra.lines.map((l, i) => (
              <div
                key={i}
                className="text-xs border-t pt-1.5 first:border-0 first:pt-0"
              >
                <div className="flex items-start gap-2">
                  <span className="flex-1 min-w-0">{l.expenseType}</span>
                  <span className="tabular-nums shrink-0">
                    {fmtMoney(l.actual, extra.currency)}
                  </span>
                </div>
                <p className="tg-hint-text">
                  {l.counterpartyName ?? 'без контрагента'} · план{' '}
                  {fmtMoney(l.planned, null)} · разница {fmtMoney(l.diff, null)}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t pt-2 space-y-1">
            <Line
              label="Расходы план / факт"
              value={`${fmtMoney(extra.plannedTotal, null)} / ${fmtMoney(extra.actualTotal, extra.currency)}`}
            />
            <Line
              label="Доход план / факт"
              value={`${fmtMoney(extra.incomePlanned, null)} / ${fmtMoney(extra.incomeActual, extra.currency)}`}
            />
            <Line
              label="Клиенту"
              value={REBILLED_LABEL[extra.rebilled] ?? extra.rebilled}
            />
            {extra.expenseBearer && (
              <Line
                label="Расход несёт"
                value={
                  EXPENSE_BEARER_LABEL[extra.expenseBearer] ??
                  extra.expenseBearer
                }
              />
            )}
            {extra.contractorClaim && (
              <Line label="Основание претензии" value={extra.contractorClaim} />
            )}
            {extra.responsibleDepartment && (
              <Line
                label="Отдел ответственного"
                value={extra.responsibleDepartment.name}
              />
            )}
            {extra.responsiblePerson && (
              <Line label="Ответственный" value={extra.responsiblePerson} />
            )}
          </div>
        </div>
      )}

      {memo.attachments.length > 0 && (
        <div className="tg-card space-y-1">
          <p className="text-sm font-medium">Документы</p>
          {memo.attachments.map((a) => (
            <p key={a.id} className="tg-hint-text">
              {a.name} · {fmtSize(a.size)}
            </p>
          ))}
          {/* Файлы бот дошлёт документами в чат: открыть их из приложения
              негде, а кабинет требует входа, которого у многих нет. */}
          <p className="tg-hint-text">Файлы приходят документами в чат бота.</p>
        </div>
      )}

      <div className="tg-card space-y-2">
        <p className="text-sm font-medium">Что происходило</p>
        <MemoHistoryList entries={history} />
      </div>

      {memo.isAuthor && memo.status === 'changes_requested' && (
        <button className="tg-button" onClick={onEdit}>
          Исправить и отправить заново
        </button>
      )}

      {memo.myTaskId && (
        <div className="tg-card space-y-2">
          <p className="text-sm font-medium">Ваше решение</p>
          {BUTTONS.map((b) => (
            <button
              key={b.kind}
              className={b.className}
              disabled={busy}
              onClick={() => {
                // Повторное нажатие снимает выбор: человек мог открыть поле
                // ввода и передумать.
                setKind(kind === b.kind ? null : b.kind);
                setComment('');
              }}
            >
              {kind === b.kind ? `${b.label} ✓` : b.label}
            </button>
          ))}

          {kind && (
            <div className="space-y-2 pt-1">
              {needsComment && (
                <textarea
                  className="tg-input min-h-[96px]"
                  autoFocus
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    kind === 'reject'
                      ? 'Причина отказа — автор должен понять, почему'
                      : 'Что нужно исправить'
                  }
                />
              )}
              <button
                className="tg-button"
                disabled={busy || tooShort}
                onClick={() => void decide()}
              >
                {DECISION[kind]?.label ?? 'Подтвердить'}
              </button>
              {tooShort && (
                <p className="tg-hint-text">Без причины отправить нельзя.</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && <div className="tg-error">{error}</div>}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="tg-hint-text flex-1 min-w-0">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}
