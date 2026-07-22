import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Trophy, CheckCircle2, Send, Loader2, MapPin, Calendar,
  MessageSquare, AlertTriangle, Clock, Sparkles, X, Mail,
} from 'lucide-react';
import {
  tenderApi, TenderDetail, TenderStatus, DeliveryStatus,
  ConversationMessage, TENDER_MODE_LABELS,
} from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUS: Record<TenderStatus, { label: string; cls: string }> = {
  draft:      { label: 'Черновик',    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  sent:       { label: 'Отправлен',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  collecting: { label: 'Сбор ставок', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  decided:    { label: 'Выбран',      cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:  { label: 'Отменён',     cls: 'bg-red-50 text-red-700 border-red-200' },
};

const DELIVERY: Record<DeliveryStatus, { label: string; cls: string }> = {
  pending: { label: 'Ожидает',    cls: 'text-slate-500' },
  sent:    { label: 'Отправлено', cls: 'text-blue-600' },
  error:   { label: 'Ошибка',     cls: 'text-red-600' },
};

const CHANNEL_LABEL: Record<string, string> = {
  telegram: 'TG', email: 'Почта', both: 'TG+Почта',
};

function money(amount: string | null, currency: string | null) {
  if (amount == null) return '—';
  return `${Number(amount).toLocaleString('ru-RU')} ${currency ?? ''}`.trim();
}

export default function RateRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const load = useCallback(() => {
    if (!id) return;
    tenderApi.tenders
      .get(id)
      .then(setTender)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const send = async () => {
    if (!id) return;
    setSending(true);
    setError(null);
    try {
      setTender(await tenderApi.tenders.send(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const select = async (supplierId: string) => {
    if (!id) return;
    setSelectingId(supplierId);
    setError(null);
    try {
      setTender(await tenderApi.tenders.select(id, supplierId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSelectingId(null);
    }
  };

  const openMessages = async () => {
    if (!id) return;
    setShowMessages(true);
    setMessages(await tenderApi.tenders.messages(id).catch(() => []));
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground"><Loader2 className="animate-spin mx-auto mb-2" /> Загрузка…</div>;
  }
  if (!tender) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Тендер не найден</div>;
  }

  const st = STATUS[tender.status];
  const pendingCount = tender.invites.filter((i) => i.deliveryStatus !== 'sent').length;
  const canSend = tender.status !== 'decided' && tender.status !== 'cancelled' && pendingCount > 0;
  const decided = tender.status === 'decided';
  // Replies ordered by rank (nulls last).
  const replies = [...tender.replies].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  return (
    <div className="space-y-4 max-w-5xl">
      <button onClick={() => navigate('/rate-requests')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
        <ArrowLeft size={13} /> К запросам
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Header card */}
      <Card>
        <CardContent className="pt-1">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin size={16} className="text-primary" />
                <span className="font-bold text-base">{tender.origin}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-bold text-base">{tender.destination}</span>
                {tender.mode && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {TENDER_MODE_LABELS[tender.mode]}
                  </span>
                )}
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', st.cls)}>{st.label}</span>
              </div>
              <div className="flex gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground flex-wrap">
                {/* Дата погрузки — @db.Date (UTC-полночь): без timeZone съезжает на день назад */}
                {tender.loadingDate && <span className="flex items-center gap-1"><Calendar size={11} /> Погрузка: {new Date(tender.loadingDate).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</span>}
                {tender.weightKg && <span>⚖️ {Number(tender.weightKg).toLocaleString('ru-RU')} кг</span>}
                {tender.cargoType && <span>📦 {tender.cargoType}{tender.cargo ? ` — ${tender.cargo}` : ''}</span>}
                {tender.hazardClass && <span className="text-red-600">☣️ {tender.hazardClass}</span>}
                {tender.temperatureRegime && <span className="text-sky-600">🌡 {tender.temperatureRegime}</span>}
                {tender.vehicleType && <span>🚚 {tender.vehicleType}{tender.vehicleCount ? ` × ${tender.vehicleCount}` : ''}</span>}
                {tender.loadingMethod && <span>↕️ {tender.loadingMethod}</span>}
                {tender.hsCodes && <span>🔢 ТНВЭД: {tender.hsCodes}</span>}
                {tender.incoterms && <span>📑 {tender.incoterms}</span>}
                {tender.bidDeadline && (
                  <span className={cn(new Date(tender.bidDeadline) < new Date() && 'text-red-600')}>
                    ⏳ приём ставок до: {new Date(tender.bidDeadline).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {tender.cargoValue && <span>💰 {Number(tender.cargoValue).toLocaleString('ru-RU')} {tender.currency ?? ''}</span>}
                {tender.exportCustoms && <span>🛃 экспорт: {tender.exportCustoms}</span>}
                {tender.importCustoms && <span>🛃 импорт: {tender.importCustoms}</span>}
                {tender.conditions && <span className="flex items-center gap-1"><MessageSquare size={11} /> {tender.conditions}</span>}
                {tender.comment && <span className="flex items-center gap-1"><MessageSquare size={11} /> {tender.comment}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openMessages} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition-colors">
                <MessageSquare size={13} /> Переписка
              </button>
              {canSend && (
                <button
                  onClick={send}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Отправить ({pendingCount})
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invites / delivery */}
      <Card>
        <CardHeader className="border-b pb-3"><CardTitle className="text-sm">Подрядчики ({tender.invites.length})</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            {tender.invites.map((inv) => {
              const d = DELIVERY[inv.deliveryStatus];
              return (
                <div key={inv.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{inv.supplier.name}</span>
                    {inv.supplier.telegramUsername && (
                      <span className="text-xs text-muted-foreground ml-2">@{inv.supplier.telegramUsername.replace('@', '')}</span>
                    )}
                    {inv.errorMessage && (
                      <div className="text-xs text-red-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={11} /> {inv.errorMessage}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{CHANNEL_LABEL[inv.channel] ?? inv.channel}</span>
                    {inv.telegramAccount && <span className="text-muted-foreground hidden sm:inline">{inv.telegramAccount.phone}</span>}
                    {inv.reminderCount > 0 && <span className="text-amber-600 flex items-center gap-1"><Clock size={11} /> {inv.reminderCount}</span>}
                    <span className={cn('font-medium', d.cls)}>{d.label}</span>
                  </div>
                </div>
              );
            })}
            {tender.invites.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Подрядчики не добавлены</div>}
          </div>
        </CardContent>
      </Card>

      {/* Replies / ranking */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Ответы и ставки ({replies.length})
            {tender.recommendedSupplierId && (
              <span className="flex items-center gap-1 text-xs font-normal text-violet-600"><Sparkles size={12} /> ИИ-рекомендация выделена</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-0">
          {replies.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Ответов пока нет — придут из Telegram</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Подрядчик</th>
                    <th className="px-4 py-2 text-right font-medium">Цена</th>
                    <th className="px-4 py-2 text-right font-medium">Срок</th>
                    <th className="px-4 py-2 text-left font-medium hidden md:table-cell">Условия</th>
                    <th className="px-4 py-2 text-center font-medium">ИИ</th>
                    <th className="px-4 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {replies.map((r) => {
                    const recommended = tender.recommendedSupplierId === r.supplierId;
                    return (
                      <tr key={r.id} className={cn(recommended && !decided && 'bg-violet-50/50', r.isSelected && 'bg-green-50/60')}>
                        <td className="px-4 py-3 text-muted-foreground">{r.rank ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{r.supplier.name}</span>
                            {recommended && !decided && <Sparkles size={12} className="text-violet-500" />}
                            {r.isSelected && <Trophy size={12} className="text-green-600" />}
                            {r.isLate && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                после дедлайна
                              </span>
                            )}
                          </div>
                          {r.accepted === false && <span className="text-xs text-red-500">отказ</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{money(r.amount, r.currency)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{r.transitDays != null ? `${r.transitDays} дн` : '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground max-w-[220px] truncate">{r.conditions ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {r.aiConfidence != null ? `${Math.round(Number(r.aiConfidence) * 100)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.isSelected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium"><CheckCircle2 size={13} /> Выбран</span>
                          ) : !decided ? (
                            <button
                              onClick={() => select(r.supplierId)}
                              disabled={selectingId != null}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-40 transition-colors"
                            >
                              {selectingId === r.supplierId ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />}
                              Выбрать
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages drawer */}
      {showMessages && (
        <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={() => setShowMessages(false)}>
          <div className="w-full max-w-md h-full bg-background shadow-xl p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Переписка</h2>
              <button onClick={() => setShowMessages(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Сообщений нет</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm max-w-[85%]',
                      m.direction === 'outgoing' ? 'bg-primary/10 ml-auto' : 'bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {m.channel === 'email'
                        ? <Mail size={11} className="text-muted-foreground" />
                        : <Send size={11} className="text-muted-foreground" />}
                      {m.subject && <span className="text-[10px] text-muted-foreground truncate">{m.subject}</span>}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(m.createdAt).toLocaleString('ru-RU')}
                      {m.status === 'error' && <span className="text-red-500 ml-1">· ошибка</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
