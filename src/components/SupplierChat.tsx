import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Mail, X, Loader2, AlertTriangle } from "lucide-react";
import { tenderApi, ConversationMessage } from "@/lib/api";
import { subscribeToChat } from "@/lib/socket";
import { cn } from "@/lib/utils";

/**
 * Переписка логиста с подрядчиком: что написала система, что ответил подрядчик
 * и что логист пишет сам. Одна лента без разделения на «бот» и «человек» —
 * подрядчик видит именно её, и логист должен видеть то же самое.
 *
 * Лента per-подрядчик, а не per-запрос: входящее сообщение записывается ДО того,
 * как система поймёт, к какому запросу оно относится, и у старых сообщений
 * привязки нет вовсе. Фильтр по запросу показывал бы одни наши исходящие.
 */
export default function SupplierChat({
  tenderId,
  supplier,
  onClose,
}: {
  tenderId: string;
  supplier: { id: string; name: string };
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    (background = false) => {
      tenderApi.tenders
        .supplierMessages(tenderId, supplier.id)
        .then(setMessages)
        // Фоновое обновление молчит об ошибках: моргнувшая сеть не должна
        // подменять открытую переписку красным текстом.
        .catch((e) => !background && setError((e as Error).message))
        .finally(() => setLoading(false));
    },
    [tenderId, supplier.id],
  );

  useEffect(() => load(), [load]);

  // Живые сообщения: и ответ подрядчика, и то, что отправила сама система.
  useEffect(() => subscribeToChat(supplier.id, () => load(true)), [supplier.id, load]);

  // Лента растёт снизу — держим взгляд на последнем сообщении.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await tenderApi.tenders.sendSupplierMessage(tenderId, supplier.id, body);
      setMessages(res.messages);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-background shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">{supplier.name}</h2>
            <p className="text-xs text-muted-foreground">Переписка</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Загрузка…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Сообщений нет</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                  m.direction === "outgoing" ? "bg-primary/10 ml-auto" : "bg-muted",
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {m.channel === "email" ? (
                    <Mail size={11} className="text-muted-foreground" />
                  ) : (
                    <Send size={11} className="text-muted-foreground" />
                  )}
                  {m.subject && (
                    <span className="text-[10px] text-muted-foreground truncate">{m.subject}</span>
                  )}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(m.createdAt).toLocaleString("ru-RU")}
                  {m.status === "error" && <span className="text-red-500 ml-1">· не доставлено</span>}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t px-5 py-3 shrink-0 space-y-2">
          {error && (
            <div className="text-xs text-red-600 flex items-start gap-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              // Enter отправляет, Shift+Enter — перенос строки: так работает
              // любой мессенджер, и логист не будет об этом задумываться.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Написать подрядчику…"
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
