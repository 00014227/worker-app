import { useState } from 'react';
import { Link2 } from 'lucide-react';
import {
  receivablesApi,
  type DebtorDocument,
  type DidoxActStatus,
} from '@/lib/api';
import { formatDate, formatDateTime } from './receivables-meta';
import { buttonClass } from './receivables-ui';
import { DidoxInvoicePicker } from './DidoxInvoicePicker';

/**
 * Связь акта со счётом-фактурой Didox, которую указывает юрист или админ (решение 26.11):
 * сверка не смогла доказать её сама — суммы расходятся, одинаковые суммы с разными
 * датами или акт в валюте. От выбранной с/ф считается срок оплаты в письмах. Сверка
 * каждый день перепроверяет связь и снимает её, если с/ф удалили, переотправили
 * или поменялись суммы.
 */

/** Статусы, при которых сверка связь не доказала — её можно указать вручную. */
const LINKABLE: DidoxActStatus[] = ['unmatched', 'not_found', 'not_sent'];

export function DidoxLinkSection({
  document,
  canAct,
  onChanged,
}: {
  document: DebtorDocument;
  canAct: boolean;
  onChanged: () => void;
}) {
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = document.didoxLink;
  const activeLink = link && !link.cancelledAt ? link : null;
  const isLinkable =
    !!document.didoxStatus && LINKABLE.includes(document.didoxStatus);
  if (!activeLink && !isLinkable) return null;

  const unlink = async () => {
    if (!activeLink) return;
    if (
      !window.confirm(
        'Снять связь? Писем по акту не будет, пока с/ф не укажут снова.',
      )
    )
      return;
    setError(null);
    try {
      await receivablesApi.unlinkDidox(activeLink.id);
      onChanged();
    } catch (cancelError) {
      setError((cancelError as Error).message);
    }
  };

  return (
    <div className="space-y-2 text-[13px]">
      {activeLink && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Link2 size={13} />
            {activeLink.kind === 'none'
              ? 'Подтверждено: с/ф к акту нет'
              : `С/ф ${activeLink.didoxNumber} от ${formatDate(activeLink.didoxDate ?? '')} указана вручную`}
            {` — ${activeLink.createdBy ?? '—'}, ${formatDateTime(activeLink.createdAt)}`}
          </span>
          {canAct && !isPicking && (
            <>
              <button
                type="button"
                onClick={() => setIsPicking(true)}
                className={buttonClass.link}
              >
                Изменить
              </button>
              <button
                type="button"
                onClick={unlink}
                className={buttonClass.danger}
              >
                Снять
              </button>
            </>
          )}
        </div>
      )}

      {!activeLink && link?.cancelledAt && (
        <div className="text-[12px] text-amber-800">
          Указанная раньше с/ф снята {formatDateTime(link.cancelledAt)}
          {link.cancelledBy ? ` (${link.cancelledBy})` : ' сверкой'}
          {link.cancelReason && `: ${link.cancelReason}`}
        </div>
      )}

      {canAct && !activeLink && !isPicking && (
        <button
          type="button"
          onClick={() => setIsPicking(true)}
          className={buttonClass.outline}
        >
          <Link2 size={15} /> Указать с/ф
        </button>
      )}

      {isPicking && (
        <DidoxInvoicePicker
          document={document}
          onDone={() => {
            setIsPicking(false);
            onChanged();
          }}
          onCancel={() => setIsPicking(false)}
        />
      )}

      {error && <div className="text-red-700">{error}</div>}
    </div>
  );
}
