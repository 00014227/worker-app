import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Loader2, Trophy, XCircle, MessageSquare } from "lucide-react";
import {
  notificationApi,
  NotificationFeed,
  NotificationRow,
  NotificationType,
} from "@/lib/api";
import { subscribeToNotifications } from "@/lib/socket";
import { cn } from "@/lib/utils";

const ICON: Record<NotificationType, typeof Bell> = {
  reply: MessageSquare,
  award_confirmed: Trophy,
  award_refused: XCircle,
};

const TONE: Record<NotificationType, string> = {
  reply: "text-blue-600",
  award_confirmed: "text-green-600",
  // Отказ выбранного подрядчика — самое срочное: машина не поедет.
  award_refused: "text-red-600",
};

/** «5 минут назад» читается быстрее, чем дата с часами. */
function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU");
}

/**
 * Колокольчик: ответы подрядчиков по запросам этого логиста, на любой странице.
 * Лента приходит из базы, а не копится в памяти вкладки — ответ, полученный
 * ночью, дождётся утра.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<NotificationFeed>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    notificationApi
      .feed()
      .then(setFeed)
      // Колокольчик — вспомогательный элемент: его сбой не должен ничего ломать.
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  // Живые уведомления. Перечитываем ленту целиком, а не дописываем пришедшее:
  // счётчик непрочитанного считает сервер, и держать его копию на клиенте
  // значит рано или поздно разойтись.
  useEffect(() => subscribeToNotifications(load), [load]);

  // Клик мимо панели закрывает её — обычное поведение выпадающих списков.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = async (n: NotificationRow) => {
    setOpen(false);
    if (!n.readAt) setFeed(await notificationApi.markRead(n.id).catch(() => feed));
    if (n.tenderId) navigate(`/rate-requests/${n.tenderId}`);
  };

  const readAll = async () => {
    setBusy(true);
    setFeed(await notificationApi.markAllRead().catch(() => feed));
    setBusy(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors"
        title="Уведомления"
      >
        <Bell size={18} />
        {feed.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
            {feed.unread > 99 ? "99+" : feed.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-80 max-h-[420px] overflow-y-auto rounded-xl border border-border bg-background shadow-lg z-50 text-foreground">
          <div className="flex items-center justify-between px-4 py-2.5 border-b sticky top-0 bg-background">
            <span className="text-sm font-medium">Уведомления</span>
            {feed.unread > 0 && (
              <button
                onClick={readAll}
                disabled={busy}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-40"
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Прочитано
              </button>
            )}
          </div>

          {feed.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Пока пусто</p>
          ) : (
            <div className="divide-y">
              {feed.items.map((n) => {
                const Icon = ICON[n.type] ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => go(n)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex gap-2.5",
                      !n.readAt && "bg-primary/5",
                    )}
                  >
                    <Icon size={14} className={cn("mt-0.5 shrink-0", TONE[n.type])} />
                    <div className="min-w-0">
                      <div className="text-sm leading-snug">{n.title}</div>
                      {n.body && (
                        <div className="text-xs text-muted-foreground truncate">{n.body}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {ago(n.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
