import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { contractDiffApi } from '@/lib/api';

/**
 * Подлинник договора на нужной странице.
 *
 * Ради этого окна и затевалось распознавание: машинному тексту юрист на слово
 * не поверит, и возможность за один клик увидеть, что написано в самом файле,
 * — то, что делает распознанный документ пригодным для работы.
 *
 * Страницу открываем через встроенный просмотр PDF браузера: он умеет
 * `#page=N`. Подсветить сам пункт внутри скана нечем — координат слов у нас
 * нет, — поэтому текст пункта показываем рядом, а не рисуем ложную рамку
 * наугад.
 */
export default function OriginalViewer({
  comparisonId,
  side,
  page,
  fileName,
  clauseText,
  onClose,
}: {
  comparisonId: string;
  side: 'left' | 'right';
  page: number | null;
  fileName: string;
  clauseText: string | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    contractDiffApi
      .originalUrl(comparisonId, side)
      .then((u) => {
        revoked = u;
        setUrl(u);
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [comparisonId, side]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-full bg-background shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{fileName}</div>
            <div className="text-xs text-muted-foreground">
              {page ? `Страница ${page}` : 'Исходный файл'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Текст пункта рядом со страницей: подсветить его внутри скана нечем,
            но сверить глазами так же удобно. */}
        {clauseText && (
          <div className="px-5 py-2.5 border-b bg-amber-50/60 text-xs leading-relaxed max-h-32 overflow-y-auto shrink-0">
            <span className="font-medium">Ищем этот пункт: </span>
            {clauseText}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {error ? (
            <p className="text-sm text-red-600 text-center py-10">{error}</p>
          ) : url ? (
            <iframe
              src={`${url}#page=${page ?? 1}`}
              title={fileName}
              className="w-full h-full border-0"
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Открываем файл…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
