import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Mic, X } from "lucide-react";
import { ConversationMessage, fetchMediaUrl } from "@/lib/api";

/** «1,4 МБ» читается быстрее, чем 1468006. */
function size(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/** «0:47» — сколько слушать, видно до нажатия. */
function duration(sec: number | null): string {
  if (!sec) return "";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/**
 * Вложение в ленте переписки.
 *
 * Файл грузится по нажатию, а не сразу: в переписке бывают десятки фото, и
 * тянуть их все при открытии чата значит заставить логиста ждать на ровном
 * месте. Голосовое и фото после загрузки показываются прямо здесь, документ
 * скачивается.
 */
export default function MessageMedia({ message }: { message: ConversationMessage }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  // Объектные ссылки живут до закрытия вкладки — отпускаем их за собой.
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!message.mediaKind) return null;

  if (message.mediaPurged) {
    return (
      <div className="text-[11px] text-muted-foreground italic mt-1">
        Файл удалён по сроку хранения
      </div>
    );
  }

  const load = async () => {
    if (url || busy) return url;
    setBusy(true);
    setError(null);
    try {
      const u = await fetchMediaUrl(message.id);
      setUrl(u);
      return u;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const u = url ?? (await load());
    if (!u) return;
    const a = document.createElement("a");
    a.href = u;
    a.download = message.mediaName ?? "file";
    a.click();
  };

  if (error) {
    return <div className="text-[11px] text-red-600 mt-1">{error}</div>;
  }

  // ── Голосовое ──
  if (message.mediaKind === "voice") {
    return (
      <div className="mt-1.5">
        {url ? (
          <audio controls autoPlay src={url} className="h-8 w-full max-w-[260px]" />
        ) : (
          <button
            onClick={load}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted/50 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
            Прослушать
            {message.mediaDuration ? (
              <span className="text-muted-foreground">{duration(message.mediaDuration)}</span>
            ) : null}
          </button>
        )}
      </div>
    );
  }

  // ── Фото ──
  if (message.mediaKind === "photo") {
    return (
      <div className="mt-1.5">
        {url ? (
          <>
            <img
              src={url}
              alt={message.mediaName ?? "фото"}
              onClick={() => setZoom(true)}
              className="rounded-lg max-h-52 cursor-zoom-in border"
            />
            {zoom && (
              <div
                onClick={() => setZoom(false)}
                className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
              >
                <img src={url} alt="" className="max-h-full max-w-full rounded-lg" />
                <button className="absolute top-4 right-4 text-white/80 hover:text-white">
                  <X size={22} />
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={load}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted/50 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            Показать фото
            <span className="text-muted-foreground">{size(message.mediaSize)}</span>
          </button>
        )}
      </div>
    );
  }

  // ── Документ ──
  return (
    <button
      onClick={download}
      disabled={busy}
      className="mt-1.5 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted/50 disabled:opacity-50 max-w-full"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      <span className="truncate">{message.mediaName ?? "файл"}</span>
      <span className="text-muted-foreground shrink-0">{size(message.mediaSize)}</span>
    </button>
  );
}
