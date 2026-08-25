import { io, Socket } from "socket.io-client";
import { getToken } from "./auth";

/** Пришла (или обновилась) ставка подрядчика. */
export interface TenderReplyEvent {
  tenderId: string;
  supplierId: string;
  supplierName: string;
  amount: string | null;
  currency: string | null;
  transitDays: number | null;
  accepted: boolean | null;
  receivedAt: string;
}

/**
 * Адрес сокета задаётся отдельно от API и намеренно указывает на сервер напрямую:
 * прокси Netlify не пропускает апгрейд WebSocket, поэтому через `/api` соединение
 * не поднимется. Пусто = живые обновления выключены (локальная разработка).
 */
const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;

let socket: Socket | null = null;

/**
 * Одно подключение на всё приложение. Страниц, которым нужны живые события,
 * будет больше одной (карточка запроса, дальше — колокольчик), а держать по
 * сокету на каждую значит переподключаться при каждом переходе.
 */
export function getSocket(): Socket | null {
  if (!WS_URL) return null;
  const token = getToken();
  if (!token) return null;

  if (!socket) {
    socket = io(`${WS_URL}/tenders`, {
      auth: { token },
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

/** Разрыв при выходе из системы — иначе сокет останется жить с чужим токеном. */
export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
}

/**
 * Подписка на обновления одного запроса. Возвращает функцию отписки: выходя со
 * страницы, комнату надо покинуть, иначе сервер продолжит слать события в
 * закрытую карточку.
 */
export function subscribeToTender(
  tenderId: string,
  onChange: () => void,
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const join = () => s.emit("join", tenderId);
  join();
  // При переподключении комната теряется — вступаем заново.
  s.on("connect", join);
  s.on("tender-reply", onChange);
  s.on("tender-updated", onChange);

  return () => {
    s.emit("leave", tenderId);
    s.off("connect", join);
    s.off("tender-reply", onChange);
    s.off("tender-updated", onChange);
  };
}

/**
 * Подписка на переписку с подрядчиком. Отдельная комната от карточки запроса:
 * чат может быть открыт и тогда, когда карточка закрыта, а сообщение приходит
 * раньше, чем система поймёт, к какому запросу оно относится.
 */
export function subscribeToChat(
  supplierId: string,
  onMessage: () => void,
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const join = () => s.emit("join-chat", supplierId);
  join();
  s.on("connect", join);
  s.on("tender-message", onMessage);

  return () => {
    s.emit("leave-chat", supplierId);
    s.off("connect", join);
    s.off("tender-message", onMessage);
  };
}

/** Уведомление логисту — приходит на любой странице, комната задана токеном. */
export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  body: string | null;
  tenderId: string | null;
  supplierId: string | null;
  createdAt: string;
}

/**
 * Подписка на уведомления. Комнату выбирать не нужно: сервер записывает в неё
 * при подключении, по идентификатору из токена.
 */
export function subscribeToNotifications(
  onNotification: (n?: NotificationEvent) => void,
): () => void {
  const s = getSocket();
  if (!s) return () => {};
  const onRead = () => onNotification();
  s.on("notification", onNotification);
  // Ленту меняет не только приход нового: прочитанное в другой вкладке или на
  // другой странице тоже должно погасить этот колокольчик.
  s.on("notifications-read", onRead);
  return () => {
    s.off("notification", onNotification);
    s.off("notifications-read", onRead);
  };
}
