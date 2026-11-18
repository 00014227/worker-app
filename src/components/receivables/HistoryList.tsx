import { useState } from 'react';
import { formatDateTime } from './receivables-meta';

export interface HistoryItem {
  id: string;
  text: string;
  createdBy: string | null;
  createdAt: string;
  cancelledBy: string | null;
  cancelledAt: string | null;
}

/** Снятые стопы и прошлые отсрочки: свёрнуто, кто поставил и кто снял. */
export function HistoryList({
  title,
  items,
}: {
  title: string;
  items: HistoryItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="text-muted-foreground hover:text-foreground"
      >
        {isOpen ? 'Скрыть' : 'Показать'} {title} ({items.length})
      </button>
      {isOpen && (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="text-muted-foreground">
              {item.text}
              <div className="text-[12px]">
                поставил {item.createdBy ?? '—'}{' '}
                {formatDateTime(item.createdAt)}
                {item.cancelledAt &&
                  ` · снял ${item.cancelledBy ?? '—'} ${formatDateTime(item.cancelledAt)}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
