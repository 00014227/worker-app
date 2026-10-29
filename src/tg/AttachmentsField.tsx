import { useRef, useState } from 'react';
import { tgApi } from './tgApi';
import type { TgAttachment } from './tgApi';

/**
 * Файлы к записке. Один блок на все три формы.
 *
 * Файл уходит на сервер **сразу при выборе**, а не при отправке записки: так
 * человек видит, что он принят, и может убрать лишний до отправки. Записка в
 * этот момент ещё не создана — файл лежит во временном хранилище и переезжает
 * в неё, когда форма будет отправлена.
 */
export default function AttachmentsField({
  files,
  onChanged,
  max,
}: {
  files: TgAttachment[];
  onChanged: (files: TgAttachment[]) => void;
  max: number;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (chosen: FileList | null) => {
    if (!chosen?.length) return;
    setBusy(true);
    setError(null);
    let added = [...files];
    try {
      // По одному, а не разом: предел проверяет сервер, и при отказе на
      // третьем файле первые два должны остаться приложенными.
      for (const file of Array.from(chosen)) {
        const saved = await tgApi.addAttachment(file);
        added = [...added, saved];
        onChanged(added);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      // Сбрасываем выбор: без этого повторный выбор того же файла не вызовет
      // событие, и человек решит, что кнопка не работает.
      if (input.current) input.current.value = '';
    }
  };

  const drop = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await tgApi.removeAttachment(id);
      onChanged(files.filter((f) => f.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Файлы</span>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="tg-card flex items-center gap-2 py-2">
              <span className="flex-1 min-w-0 truncate text-sm">{f.name}</span>
              <span className="tg-hint-text shrink-0">{fmtSize(f.size)}</span>
              <button
                type="button"
                className="tg-icon-button"
                onClick={() => void drop(f.id)}
                disabled={busy}
                aria-label="Убрать файл"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length < max ? (
        <>
          <button
            type="button"
            className="tg-add-row"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {busy ? 'Отправляем…' : '+ Прикрепить файл'}
          </button>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            // Белый список тот же, что проверяет сервер: счёт, акт, скан.
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={(e) => void pick(e.target.files)}
          />
        </>
      ) : (
        <p className="tg-hint-text">Больше {max} файлов приложить нельзя</p>
      )}

      {error && <div className="tg-error">{error}</div>}
    </div>
  );
}

/** Размер файла — килобайты или мегабайты, без лишней точности. */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
