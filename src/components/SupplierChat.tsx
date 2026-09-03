import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Mail, X, Loader2, AlertTriangle, Paperclip } from 'lucide-react';
import { tenderApi, notificationApi, ConversationMessage } from '@/lib/api';
import { subscribeToChat } from '@/lib/socket';
import MessageMedia from './MessageMedia';
import { cn } from '@/lib/utils';

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
  onRead,
}: {
  tenderId: string;
  supplier: { id: string; name: string };
  onClose: () => void;
  /** Переписку прочитали — карточке пора обновить значки непрочитанного. */
  onRead?: () => void;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  /** Выбранный файл — уходит вместе с текстом как подписью. */
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
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

  /**
   * Открытая переписка — прочитанная переписка. Гасим по ней всё непрочитанное:
   * каждое входящее сообщение заводит своё уведомление, а прочитаны они здесь
   * все разом. Молча при сбое — уведомления вспомогательные, чат важнее.
   */
  // Через ref, а не через зависимость: родитель передаёт обработчик встроенной
  // стрелкой, и от неё эффект пересоздавался бы на каждую отрисовку. Обновляем
  // ref в эффекте, а не по ходу отрисовки — во время рендера ref трогать нельзя.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  const markRead = useCallback(() => {
    notificationApi
      .markThreadRead(tenderId, supplier.id)
      .then(() => onReadRef.current?.())
      .catch(() => undefined);
  }, [tenderId, supplier.id]);

  useEffect(() => {
    load();
    markRead();
  }, [load, markRead]);

  // Живые сообщения: и ответ подрядчика, и то, что отправила сама система.
  // Пришедшее в открытый чат сразу и прочитано — гасим и его.
  useEffect(
    () =>
      subscribeToChat(supplier.id, () => {
        load(true);
        markRead();
      }),
    [supplier.id, load, markRead],
  );

  // Лента растёт снизу — держим взгляд на последнем сообщении.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if ((!body && !file) || sending) return;
    setSending(true);
    setError(null);
    try {
      // Файл уходит одним сообщением с подписью — два отдельных сообщения
      // и выглядят хуже, и тратят вдвое больше квоты аккаунта.
      const res = file
        ? await tenderApi.tenders.sendSupplierFile(
            tenderId,
            supplier.id,
            file,
            body,
          )
        : await tenderApi.tenders.sendSupplierMessage(
            tenderId,
            supplier.id,
            body,
          );
      setMessages(res.messages);
      setText('');
      setFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex justify-end"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-w-md h-full bg-background shadow-xl flex flex-col relative',
          dragOver && 'ring-2 ring-primary ring-inset',
        )}
        onClick={(e) => e.stopPropagation()}
        // Перетаскивание в окно чата: логист приходит из Проводника и из почты,
        // и заставлять его каждый раз идти через скрепку незачем.
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          // Уход на дочерний элемент — не выход из окна.
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 bg-primary/5 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-medium text-primary">
              Отпустите файл
            </span>
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">{supplier.name}</h2>
            <p className="text-xs text-muted-foreground">Переписка</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Загрузка…
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Сообщений нет
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm max-w-[85%]',
                  m.direction === 'outgoing'
                    ? 'bg-primary/10 ml-auto'
                    : 'bg-muted',
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {m.channel === 'email' ? (
                    <Mail size={11} className="text-muted-foreground" />
                  ) : (
                    <Send size={11} className="text-muted-foreground" />
                  )}
                  {m.subject && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {m.subject}
                    </span>
                  )}
                </div>
                {m.text && (
                  <div className="whitespace-pre-wrap break-words">
                    {m.text}
                  </div>
                )}
                <MessageMedia message={m} />
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(m.createdAt).toLocaleString('ru-RU')}
                  {m.status === 'error' && (
                    <span className="text-red-500 ml-1">· не доставлено</span>
                  )}
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
          {file && (
            <div className="flex items-center gap-2 text-xs rounded-lg border bg-muted/40 px-2.5 py-1.5">
              <Paperclip size={12} className="shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="text-muted-foreground shrink-0">
                {Math.max(1, Math.round(file.size / 1024))} КБ
              </span>
              <button
                onClick={() => setFile(null)}
                className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
                title="Убрать файл"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              title="Прикрепить файл или фото"
              className="h-9 px-2.5 rounded-lg border hover:bg-muted/50 disabled:opacity-40 transition-colors"
            >
              <Paperclip size={14} />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              // Enter отправляет, Shift+Enter — перенос строки: так работает
              // любой мессенджер, и логист не будет об этом задумываться.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
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
              disabled={(!text.trim() && !file) || sending}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
