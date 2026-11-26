import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  receivablesApi,
  type DebtorDocument,
  type DidoxInvoiceCandidate,
} from '@/lib/api';
import { formatDate, formatMoney } from './receivables-meta';
import { buttonClass } from './receivables-ui';

const STATUS_TEXT: Record<DidoxInvoiceCandidate['status'], string> = {
  signed: 'подписана',
  pending: 'ждёт подписи',
  rejected: 'отказ',
};

/** Ключ с/ф в списке: номер в Didox повторяется после переотправки, поэтому с датой. */
const keyOf = (candidate: DidoxInvoiceCandidate) =>
  `${candidate.number}|${candidate.date}`;

/**
 * Выбор с/ф для акта: с/ф клиента в Didox рядом с датой акта (свежие, с сервера) и
 * вариант «с/ф нет». Расхождения — другой договор, другая сумма, с/ф уже у другого
 * акта — подсвечены: выбрать можно, но человек должен их видеть.
 */
export function DidoxInvoicePicker({
  document,
  onDone,
  onCancel,
}: {
  document: DebtorDocument;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [candidates, setCandidates] = useState<DidoxInvoiceCandidate[] | null>(
    null,
  );
  /** Ключ выбранной с/ф или 'none' — «с/ф нет». */
  const [choice, setChoice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    receivablesApi
      .didoxInvoices(document.id)
      .then(setCandidates)
      .catch((loadError: Error) => setError(loadError.message));
  }, [document.id]);

  const confirm = async () => {
    const picked = candidates?.find((candidate) => keyOf(candidate) === choice);
    if (!choice || (choice !== 'none' && !picked)) return;
    setIsSaving(true);
    setError(null);
    try {
      await receivablesApi.linkDidox(
        document.id,
        picked
          ? { kind: 'invoice', number: picked.number, date: picked.date }
          : { kind: 'none' },
      );
      onDone();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2.5 rounded-[10px] border border-border bg-card p-3">
      <div className="text-[12px] text-muted-foreground">
        Какой счёт-фактурой Didox выставлен акт на{' '}
        {formatMoney({ amount: document.amount, currency: document.currency })}?
        Сверьте номер, маршрут и сумму в Didox — от выбранной с/ф будет
        считаться срок оплаты.
      </div>
      {!candidates && !error && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Загружаем с/ф из Didox…
        </div>
      )}
      {candidates && (
        <fieldset className="space-y-1.5">
          <legend className="sr-only">
            Счёт-фактура к акту {document.docNumber}
          </legend>
          {candidates.length === 0 && (
            <div className="text-muted-foreground">
              Рядом с датой акта у клиента в Didox счетов-фактур нет.
            </div>
          )}
          {candidates.map((candidate) => (
            <CandidateOption
              key={keyOf(candidate)}
              candidate={candidate}
              document={document}
              isChecked={choice === keyOf(candidate)}
              onPick={() => setChoice(keyOf(candidate))}
            />
          ))}
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name={`didox-${document.id}`}
              checked={choice === 'none'}
              onChange={() => setChoice('none')}
              className="mt-1"
            />
            <span>
              С/ф к этому акту нет — писем нет, случай остаётся в отчёте
            </span>
          </label>
        </fieldset>
      )}
      {error && <div className="text-red-700">{error}</div>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={!choice || isSaving}
          className={buttonClass.primary}
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          Подтвердить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass.outline}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function CandidateOption({
  candidate,
  document,
  isChecked,
  onPick,
}: {
  candidate: DidoxInvoiceCandidate;
  document: DebtorDocument;
  isChecked: boolean;
  onPick: () => void;
}) {
  const difference = Number(candidate.sum) - Number(document.amount);
  const warnings = [
    !candidate.isSameContract &&
      `другой договор${candidate.contractNumber ? ` (${candidate.contractNumber})` : ''}`,
    document.currency === 'UZS' &&
      Math.abs(difference) >= 0.01 &&
      `сумма ${difference > 0 ? 'больше' : 'меньше'} акта на ${formatMoney({ amount: String(Math.abs(difference)), currency: 'UZS' })}`,
    candidate.linkedActs.length > 0 &&
      `уже связана с ${candidate.linkedActs.join(', ')}`,
  ].filter(Boolean);

  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="radio"
        name={`didox-${document.id}`}
        checked={isChecked}
        onChange={onPick}
        className="mt-1"
      />
      <span>
        <span className="font-medium">
          № {candidate.number} от {formatDate(candidate.date)}
        </span>{' '}
        — {formatMoney({ amount: candidate.sum, currency: 'UZS' })},{' '}
        {STATUS_TEXT[candidate.status]}
        {candidate.contractNumber &&
          candidate.isSameContract &&
          `, договор ${candidate.contractNumber}`}
        {candidate.lines.map((line) => (
          <span key={line} className="block text-[12px] text-muted-foreground">
            {line}
          </span>
        ))}
        {warnings.length > 0 && (
          <span className="block text-[12px] text-amber-800">
            {warnings.join(' · ')}
          </span>
        )}
      </span>
    </label>
  );
}
