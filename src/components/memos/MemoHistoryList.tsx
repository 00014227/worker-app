import { EVENT_LABEL, HISTORY_NOTE_LABEL, fmtDateTime } from './memo-meta';
import type { MemoHistoryEntry } from '@/lib/api';

/**
 * Хронологическая лента истории записки.
 *
 * Показывает то, чего прежний журнал в кабинете не показывал: кто совершил
 * действие, по какому этапу и с каким комментарием. Прежний рисовал только дату
 * и подпись вида, а имя актора и `payload` приходили с сервера и выбрасывались.
 *
 * Один компонент на кабинет и на Telegram: состав записи с сервера один, и две
 * ленты разошлись бы в подписях.
 */
export default function MemoHistoryList({
  entries,
}: {
  entries: MemoHistoryEntry[];
}) {
  if (entries.length === 0) {
    return <p className="tg-hint-text">Пока ничего не происходило.</p>;
  }

  return (
    <ol className="space-y-2">
      {entries.map((e, i) => {
        const note = e.comment?.trim();
        return (
          <li key={`${e.at}-${e.kind}-${i}`} className="text-xs">
            <div className="flex items-start gap-2">
              <span className="tg-hint-text tabular-nums shrink-0">
                {fmtDateTime(e.at)}
              </span>
              <span className="flex-1 min-w-0">
                {EVENT_LABEL[e.kind] ?? e.kind}
                {e.stepNo !== null && (
                  <span className="tg-hint-text"> · этап {e.stepNo}</span>
                )}
                {/* Номер попытки показываем только со второй: «попытка 1» у
                    всего подряд засоряет ленту, а второй круг надо видеть. */}
                {e.attempt !== null && e.attempt > 1 && (
                  <span className="tg-hint-text"> · круг {e.attempt}</span>
                )}
              </span>
            </div>
            {(e.actorName || e.roleName) && (
              <p className="tg-hint-text pl-[calc(5.5rem)]">
                {[e.roleName, e.actorName].filter(Boolean).join(': ')}
                {e.source === 'telegram' ? ' · из Telegram' : ''}
              </p>
            )}
            {note && (
              <p className="mt-0.5 rounded bg-black/5 px-2 py-1 whitespace-pre-wrap break-words">
                <span className="tg-hint-text">
                  {HISTORY_NOTE_LABEL[e.kind] ?? 'Комментарий'}:{' '}
                </span>
                {note}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
