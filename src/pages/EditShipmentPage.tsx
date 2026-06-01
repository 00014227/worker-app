import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, RefreshCw } from 'lucide-react';
import { workerApi, OrderRow } from '../lib/api';
import ShipmentForm, { ShipmentFormData, emptyForm } from '../components/ShipmentForm';
import { cn } from '@/lib/utils';

function fromOrder(o: OrderRow): ShipmentFormData {
  return {
    ...emptyForm,
    transportationType: o.transportationType ?? '',
    postingDate: o.postingDate ?? emptyForm.postingDate,
    clientOrderNumber: o.clientOrderNumber ?? '',
    status: o.status ?? 'В работе',
    payer: o.payer?.name ?? '',
    customer: o.customer?.name ?? '',
    departure: o.departure ?? '',
    destination: o.destination ?? '',
    departureDatePlan: o.departureDatePlan ?? '',
    departureDateActual: o.departureDateActual ?? '',
    arrivalDatePlan: o.arrivalDatePlan ?? '',
    arrivalDateActual: o.arrivalDateActual ?? '',
    declaredWeight: o.declaredWeight > 0 ? String(o.declaredWeight) : '',
    actualWeight: o.actualWeight > 0 ? String(o.actualWeight) : '',
    vehicleCount: o.vehicleCount > 0 ? String(o.vehicleCount) : '',
    vehicleNumbers: o.vehicleNumbers ?? '',
    waybillNumber: o.waybillNumber ?? '',
    currentLocation: o.currentLocation ?? '',
    tracingComment: o.tracingComment ?? '',
    responsible: o.responsible?.name ?? '',
    keyAccountManager: o.keyAccountManager?.name ?? '',
    comment: o.comment ?? '',
    legs: [],
  };
}

export default function EditShipmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<ShipmentFormData>(emptyForm);
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    workerApi.orders.get(id)
      .then(o => { setForm(fromOrder(o)); setOrderNumber(o.number); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const isMulti = form.transportationType === 'Мультимодальная';
  const canSave = !!form.transportationType && (
    isMulti
      ? form.legs.length > 0 && form.legs.every(l => l.departure && l.destination)
      : !!form.departure && !!form.destination
  );

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
      <RefreshCw size={16} className="animate-spin mr-2" /> Загрузка...
    </div>
  );

  if (error) return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft size={16} /> Назад
      </button>
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    </div>
  );

  if (saved) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Save size={22} className="text-green-600" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Изменения сохранены</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Подключение к API будет добавлено в следующем обновлении.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(`/shipments/${id}`)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            К перевозке
          </button>
          <button onClick={() => navigate('/shipments')} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            К списку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-6">
        <button onClick={() => navigate(`/shipments/${id}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ChevronLeft size={15} /> {orderNumber}
        </button>
        <h1 className="text-xl font-bold">Редактировать перевозку</h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{orderNumber}</p>
      </div>

      <ShipmentForm form={form} onChange={setForm} />

      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <button onClick={() => navigate(`/shipments/${id}`)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
          <ChevronLeft size={14} /> Отмена
        </button>
        <button
          onClick={() => setSaved(true)}
          disabled={!canSave}
          className={cn(
            'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-colors',
            canSave ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          <Save size={14} /> Сохранить изменения
        </button>
      </div>
    </div>
  );
}
