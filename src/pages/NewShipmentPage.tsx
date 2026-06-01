import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save } from 'lucide-react';
import ShipmentForm, { ShipmentFormData, emptyForm } from '../components/ShipmentForm';
import { cn } from '@/lib/utils';

export default function NewShipmentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ShipmentFormData>(emptyForm);
  const [saved, setSaved] = useState(false);

  const isMulti = form.transportationType === 'Мультимодальная';
  const canSave = !!form.transportationType && (
    isMulti
      ? form.legs.length > 0 && form.legs.every(l => l.departure && l.destination)
      : !!form.departure && !!form.destination
  );

  if (saved) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Save size={22} className="text-green-600" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Перевозка создана</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Данные сохранены. Подключение к API будет добавлено в следующем обновлении.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/shipments')} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            К списку
          </button>
          <button onClick={() => { setForm(emptyForm); setSaved(false); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Создать ещё
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-6">
        <button onClick={() => navigate('/shipments')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ChevronLeft size={15} /> Перевозки
        </button>
        <h1 className="text-xl font-bold">Новая перевозка</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Заполните данные о перевозке</p>
      </div>

      <ShipmentForm form={form} onChange={setForm} />

      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <button onClick={() => navigate('/shipments')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
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
          <Save size={14} /> Сохранить перевозку
        </button>
      </div>
    </div>
  );
}
