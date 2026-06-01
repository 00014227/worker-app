import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ArrowRight, Package, Weight, Calendar,
  Truck, MapPin, Hash, MessageSquare, User, Building2,
  Plane, Train, Layers, RefreshCw, Pencil,
} from 'lucide-react';
import { workerApi, OrderRow } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  'Авто':             <Truck size={14} />,
  'Авиа':             <Plane size={14} />,
  'Железнодорожная':  <Train size={14} />,
  'Мультимодальная':  <Layers size={14} />,
};
const TYPE_COLORS: Record<string, string> = {
  'Авто':             'bg-orange-100 text-orange-700',
  'Авиа':             'bg-sky-100 text-sky-700',
  'Железнодорожная':  'bg-violet-100 text-violet-700',
  'Мультимодальная':  'bg-teal-100 text-teal-700',
};

function statusColor(s: string | null) {
  if (!s) return 'bg-blue-50 text-blue-700';
  const l = s.toLowerCase();
  if (l.includes('завершен') || l.includes('доставлен')) return 'bg-green-50 text-green-700';
  if (l.includes('отмен')) return 'bg-red-50 text-red-700';
  return 'bg-blue-50 text-blue-700';
}

function Field({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-sm mt-0.5 font-medium', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const order = await workerApi.orders.get(id);
      setOrder(order);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
      <RefreshCw size={16} className="animate-spin mr-2" /> Загрузка...
    </div>
  );

  if (error || !order) return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft size={16} /> Назад
      </button>
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? 'Перевозка не найдена'}
      </div>
    </div>
  );

  const o = order;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} /> Назад
        </button>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <RefreshCw size={12} /> Обновить
          </button>
          <button
            onClick={() => navigate(`/shipments/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
          >
            <Pencil size={12} /> Редактировать
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold">{o.number}</h1>
        <span className={cn('px-3 py-1 rounded-full text-sm font-medium', statusColor(o.status))}>
          {o.status ?? 'Открытые'}
        </span>
        {o.transportationType && (
          <span className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium', TYPE_COLORS[o.transportationType] ?? 'bg-slate-100 text-slate-600')}>
            {TYPE_ICONS[o.transportationType]}
            {o.transportationType}
          </span>
        )}
        {o.postingDate && (
          <span className="text-sm text-muted-foreground">от {o.postingDate}</span>
        )}
      </div>

      {/* Route banner */}
      {(o.departure || o.destination) && (
        <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-r from-muted/40 to-muted/10 px-5 py-4">
          <div className="flex-1 text-center">
            <p className="text-lg font-semibold">{o.departure ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Отправление</p>
            {o.departureDateActual && <p className="text-xs text-green-600 mt-1">факт: {o.departureDateActual}</p>}
            {!o.departureDateActual && o.departureDatePlan && <p className="text-xs text-muted-foreground mt-1">план: {o.departureDatePlan}</p>}
          </div>
          <div className="text-muted-foreground">
            <ArrowRight size={20} />
          </div>
          <div className="flex-1 text-center">
            <p className="text-lg font-semibold">{o.destination ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Назначение</p>
            {o.arrivalDateActual && <p className="text-xs text-green-600 mt-1">факт: {o.arrivalDateActual}</p>}
            {!o.arrivalDateActual && o.arrivalDatePlan && <p className="text-xs text-muted-foreground mt-1">план: {o.arrivalDatePlan}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client & responsible */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Building2 size={14} /> Клиент</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Плательщик" value={o.payer?.name} />
            <Field label="Клиент" value={o.customer?.name} />
            {o.clientOrderNumber && <Field label="Номер заказа клиента" value={o.clientOrderNumber} mono />}
            {o.department && <Field label="Подразделение" value={o.department} />}
          </CardContent>
        </Card>

        {/* Responsible */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><User size={14} /> Ответственные</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Ответственный" value={o.responsible?.name} />
            <Field label="Ключевой аккаунт-менеджер" value={o.keyAccountManager?.name} />
          </CardContent>
        </Card>

        {/* Cargo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Package size={14} /> Груз и транспорт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {o.declaredWeight > 0 && <Field label="Заявленный вес, кг" value={o.declaredWeight.toLocaleString('ru-RU')} />}
            {o.actualWeight > 0 && <Field label="Фактический вес, кг" value={o.actualWeight.toLocaleString('ru-RU')} />}
            {o.vehicleCount > 0 && <Field label="Кол-во ТС" value={o.vehicleCount} />}
            <Field label="Номера ТС" value={o.vehicleNumbers} mono />
          </CardContent>
        </Card>

        {/* Tracking */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><MapPin size={14} /> Отслеживание</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Текущее местоположение" value={o.currentLocation} />
            <Field label="Трек-номер / накладная" value={o.waybillNumber} mono />
            {o.tracingComment && <Field label="Комментарий трейсинга" value={o.tracingComment} />}
          </CardContent>
        </Card>
      </div>

      {/* Comments */}
      {o.comment && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare size={14} /> Комментарий</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{o.comment}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
