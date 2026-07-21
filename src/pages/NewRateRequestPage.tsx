import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Send as SendIcon, Check, Loader2, RotateCcw } from 'lucide-react';
import {
  tenderApi, SupplierRow, TenderMode, TENDER_MODE_LABELS, CreateTenderInput,
  CONTACT_CHANNEL_LABELS, CARGO_TYPES, CargoType, VEHICLE_TYPES, REF_VEHICLE_TYPE,
  LOADING_METHODS, INCOTERMS,
} from '../lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MODES: TenderMode[] = ['auto', 'rail', 'air', 'sea'];
const CURRENCIES = ['USD', 'EUR', 'RUB', 'UZS', 'KZT', 'CNY'];
/** Repeat calculations should not start from scratch — remember the last input. */
const DRAFT_KEY = 'transasia.tender.draft';

type FormState = Omit<CreateTenderInput, 'weightKg' | 'vehicleCount' | 'cargoValue' | 'supplierIds'> & {
  weightKg: string;
  vehicleCount: string;
  cargoValue: string;
  /** Значение <input type="datetime-local"> — местное время без зоны. */
  bidDeadline: string;
};

const emptyForm: FormState = {
  origin: '', originIndex: '', originCountry: '',
  destination: '', destinationIndex: '', destinationCountry: '',
  loadingDate: '',
  cargoType: 'генеральный',
  hazardClass: '', temperatureRegime: '',
  vehicleCount: '1', vehicleType: '',
  hsCodes: '', loadingMethod: '',
  weightKg: '',
  exportCustoms: '', importCustoms: '',
  incoterms: '', cargoValue: '', bidDeadline: '',
  conditions: '', comment: '',
  mode: undefined, cargo: '', currency: 'USD',
};

const selectCls = 'w-full h-8 rounded-md border border-border bg-background px-2 text-sm outline-none';

export default function NewRateRequestPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      // Loading date is intentionally not restored — it's almost always different.
      // Dates are deliberately not restored — they're almost always different,
      // and a stale one would silently go out to contractors.
      if (saved) return { ...emptyForm, ...JSON.parse(saved), loadingDate: '', bidDeadline: '' };
    } catch { /* corrupted draft — start clean */ }
    return emptyForm;
  });
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    tenderApi.suppliers.list().then(setSuppliers).catch((e) => setError((e as Error).message));
  }, []);

  // Persist the draft so a repeat request starts from the previous one.
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* quota */ }
  }, [form]);

  const isTemp = form.cargoType === 'температурный';
  const isHazard = form.cargoType === 'опасный';
  // Temperature cargo travels only in a reefer.
  const vehicleOptions = isTemp ? [REF_VEHICLE_TYPE] : [...VEHICLE_TYPES];

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const setCargoType = (cargoType: CargoType) => {
    setForm((f) => ({
      ...f,
      cargoType,
      // Keep the body type consistent with the cargo, and drop values that no
      // longer apply so they can't be submitted invisibly.
      vehicleType:
        cargoType === 'температурный'
          ? REF_VEHICLE_TYPE
          : f.vehicleType === REF_VEHICLE_TYPE ? '' : f.vehicleType,
      hazardClass: cargoType === 'опасный' ? f.hazardClass : '',
      temperatureRegime: cargoType === 'температурный' ? f.temperatureRegime : '',
    }));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.telegramUsername ?? '').toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!form.origin.trim()) m.push('Город отправления');
    if (!form.destination.trim()) m.push('Город назначения');
    if (!form.loadingDate) m.push('Дата погрузки');
    if (!form.cargoType) m.push('Тип груза');
    if (isHazard && !form.hazardClass?.trim()) m.push('Класс опасности');
    if (isTemp && !form.temperatureRegime?.trim()) m.push('Температурный режим');
    if (!form.vehicleCount || Number(form.vehicleCount) < 1) m.push('Количество ТС');
    if (!form.vehicleType) m.push('Вид транспорта');
    if (!form.hsCodes.trim()) m.push('Код ТНВЭД');
    if (!form.weightKg || Number(form.weightKg) <= 0) m.push('Масса брутто');
    if (!form.exportCustoms.trim()) m.push('Экспортное оформление');
    if (!form.importCustoms.trim()) m.push('Импортное оформление');
    if (!form.incoterms) m.push('Инкотермс');
    return m;
  }, [form, isHazard, isTemp]);

  const submit = async () => {
    setTouched(true);
    if (missing.length) {
      setError(`Заполните обязательные поля: ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateTenderInput = {
        ...form,
        weightKg: Number(form.weightKg),
        vehicleCount: Number(form.vehicleCount),
        cargoValue: form.cargoValue ? Number(form.cargoValue) : undefined,
        // datetime-local has no timezone: parse it as the manager's local time and
        // send a real instant, otherwise the server (UTC) would shift it by hours.
        bidDeadline: form.bidDeadline ? new Date(form.bidDeadline).toISOString() : undefined,
        loadingMethod: form.loadingMethod || undefined,
        supplierIds: selected.size ? [...selected] : undefined,
      };
      const tender = await tenderApi.tenders.create(payload);
      navigate(`/rate-requests/${tender.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const req = (label: string) => <>{label} <span className="text-red-500">*</span></>;
  const invalid = (v: string | undefined) => touched && !v?.trim();

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/rate-requests')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <ArrowLeft size={13} /> К запросам
        </button>
        <button
          onClick={() => { setForm(emptyForm); setSelected(new Set()); setTouched(false); }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
        >
          <RotateCcw size={12} /> Очистить форму
        </button>
      </div>

      <h1 className="text-xl font-bold">Новый запрос ставок</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Маршрут ── */}
      <Card>
        <CardHeader className="border-b pb-3"><CardTitle className="text-sm">Маршрут</CardTitle></CardHeader>
        <CardContent className="pt-1 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{req('Город отправления')}</Label>
              <Input value={form.origin} onChange={(e) => set({ origin: e.target.value })} placeholder="Москва"
                className={cn(invalid(form.origin) && 'border-red-400')} />
            </div>
            <div className="space-y-1.5">
              <Label>Индекс</Label>
              <Input value={form.originIndex ?? ''} onChange={(e) => set({ originIndex: e.target.value })} placeholder="101000" />
            </div>
            <div className="space-y-1.5">
              <Label>Страна</Label>
              <Input value={form.originCountry ?? ''} onChange={(e) => set({ originCountry: e.target.value })} placeholder="Россия" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{req('Город назначения')}</Label>
              <Input value={form.destination} onChange={(e) => set({ destination: e.target.value })} placeholder="Ташкент"
                className={cn(invalid(form.destination) && 'border-red-400')} />
            </div>
            <div className="space-y-1.5">
              <Label>Индекс</Label>
              <Input value={form.destinationIndex ?? ''} onChange={(e) => set({ destinationIndex: e.target.value })} placeholder="100000" />
            </div>
            <div className="space-y-1.5">
              <Label>Страна</Label>
              <Input value={form.destinationCountry ?? ''} onChange={(e) => set({ destinationCountry: e.target.value })} placeholder="Узбекистан" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Груз ── */}
      <Card>
        <CardHeader className="border-b pb-3"><CardTitle className="text-sm">Груз</CardTitle></CardHeader>
        <CardContent className="pt-1 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{req('Дата погрузки')}</Label>
              <Input type="date" value={form.loadingDate} onChange={(e) => set({ loadingDate: e.target.value })}
                className={cn(invalid(form.loadingDate) && 'border-red-400')} />
            </div>
            <div className="space-y-1.5">
              <Label>{req('Масса брутто, кг')}</Label>
              <Input type="number" value={form.weightKg} onChange={(e) => set({ weightKg: e.target.value })} placeholder="5000"
                className={cn(touched && (!form.weightKg || Number(form.weightKg) <= 0) && 'border-red-400')} />
            </div>
            <div className="space-y-1.5">
              <Label>Наименование груза</Label>
              <Input value={form.cargo ?? ''} onChange={(e) => set({ cargo: e.target.value })} placeholder="Оборудование" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{req('Тип груза')}</Label>
            <div className="flex gap-2 flex-wrap">
              {CARGO_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setCargoType(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize',
                    form.cargoType === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Условные поля */}
          {isHazard && (
            <div className="space-y-1.5">
              <Label>{req('Класс опасности')}</Label>
              <Input value={form.hazardClass ?? ''} onChange={(e) => set({ hazardClass: e.target.value })} placeholder="напр. 3 (легковоспламеняющиеся жидкости)"
                className={cn(invalid(form.hazardClass) && 'border-red-400')} />
            </div>
          )}
          {isTemp && (
            <div className="space-y-1.5">
              <Label>{req('Температурный режим')}</Label>
              <Input value={form.temperatureRegime ?? ''} onChange={(e) => set({ temperatureRegime: e.target.value })} placeholder="напр. +2…+8 °C"
                className={cn(invalid(form.temperatureRegime) && 'border-red-400')} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{req('Код ТНВЭД')}</Label>
              <Input value={form.hsCodes} onChange={(e) => set({ hsCodes: e.target.value })} placeholder="8471, 8473"
                className={cn(invalid(form.hsCodes) && 'border-red-400')} />
              <p className="text-xs text-muted-foreground">Несколько кодов — через запятую.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Стоимость груза</Label>
              <div className="flex gap-2">
                <Input type="number" value={form.cargoValue} onChange={(e) => set({ cargoValue: e.target.value })} placeholder="45000" />
                <select value={form.currency ?? ''} onChange={(e) => set({ currency: e.target.value })} className={cn(selectCls, 'w-24')}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Транспорт ── */}
      <Card>
        <CardHeader className="border-b pb-3"><CardTitle className="text-sm">Транспорт</CardTitle></CardHeader>
        <CardContent className="pt-1 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{req('Количество ТС')}</Label>
              <Input type="number" min={1} value={form.vehicleCount} onChange={(e) => set({ vehicleCount: e.target.value })}
                className={cn(touched && Number(form.vehicleCount) < 1 && 'border-red-400')} />
            </div>
            <div className="space-y-1.5">
              <Label>{req('Вид транспорта')}</Label>
              <select value={form.vehicleType} onChange={(e) => set({ vehicleType: e.target.value })}
                className={cn(selectCls, invalid(form.vehicleType) && 'border-red-400')}>
                <option value="">— выберите —</option>
                {vehicleOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              {isTemp && <p className="text-xs text-muted-foreground">Для температурного груза доступен только REF.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Способ погрузки</Label>
              <select value={form.loadingMethod ?? ''} onChange={(e) => set({ loadingMethod: e.target.value })} className={selectCls}>
                <option value="">— не указан —</option>
                {LOADING_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Тип перевозки</Label>
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button key={m} type="button" onClick={() => set({ mode: form.mode === m ? undefined : m })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    form.mode === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}>
                  {TENDER_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Таможня и условия ── */}
      <Card>
        <CardHeader className="border-b pb-3"><CardTitle className="text-sm">Таможня и условия</CardTitle></CardHeader>
        <CardContent className="pt-1 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{req('Экспортное оформление')}</Label>
              <Input value={form.exportCustoms} onChange={(e) => set({ exportCustoms: e.target.value })} placeholder="Москва, СВХ"
                className={cn(invalid(form.exportCustoms) && 'border-red-400')} />
            </div>
            <div className="space-y-1.5">
              <Label>{req('Импортное оформление')}</Label>
              <Input value={form.importCustoms} onChange={(e) => set({ importCustoms: e.target.value })} placeholder="Ташкент, СВХ Сергели"
                className={cn(invalid(form.importCustoms) && 'border-red-400')} />
            </div>
            <div className="space-y-1.5">
              <Label>{req('Инкотермс')}</Label>
              <select value={form.incoterms} onChange={(e) => set({ incoterms: e.target.value })}
                className={cn(selectCls, invalid(form.incoterms) && 'border-red-400')}>
                <option value="">— выберите —</option>
                {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Дедлайн подачи ставки</Label>
              <Input type="datetime-local" value={form.bidDeadline}
                onChange={(e) => set({ bidDeadline: e.target.value })} />
              <p className="text-xs text-muted-foreground">До какого момента ждём ставку от подрядчика.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Особые условия</Label>
              <Input value={form.conditions ?? ''} onChange={(e) => set({ conditions: e.target.value })} placeholder="Груз на палетах, растентовка…" />
            </div>
            <div className="space-y-1.5">
              <Label>Комментарий</Label>
              <Input value={form.comment ?? ''} onChange={(e) => set({ comment: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Подрядчики ── */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm">
            Подрядчики {selected.size > 0 && <span className="text-primary font-normal">· выбрано {selected.size}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1 space-y-3">
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="Поиск…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Подрядчики не найдены</div>
            ) : (
              filtered.map((s) => {
                const on = selected.has(s.id);
                const tgOk = !!(s.telegramUsername || s.telegramBound);
                const emailOk = !!s.email;
                const unreachable =
                  (s.contactChannel === 'telegram' && !tgOk) ||
                  (s.contactChannel === 'email' && !emailOk) ||
                  (s.contactChannel === 'both' && !tgOk && !emailOk);
                return (
                  <button key={s.id} type="button" onClick={() => toggle(s.id)}
                    className={cn('w-full flex items-center gap-3 px-3 py-2 text-left transition-colors', on ? 'bg-primary/5' : 'hover:bg-muted/40')}>
                    <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      on ? 'bg-primary border-primary text-primary-foreground' : 'border-border')}>
                      {on && <Check size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium block truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {CONTACT_CHANNEL_LABELS[s.contactChannel]}
                        {s.telegramUsername && ` · @${s.telegramUsername.replace('@', '')}`}
                        {s.email && ` · ${s.email}`}
                      </span>
                    </span>
                    {unreachable && <span className="text-xs text-amber-600 shrink-0">нет контакта</span>}
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap pb-6">
        <button
          disabled={saving}
          onClick={submit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <SendIcon size={15} />}
          Создать запрос
        </button>
        <span className="text-xs text-muted-foreground">
          {touched && missing.length > 0
            ? `Не заполнено: ${missing.length}`
            : 'Отправка подрядчикам — на следующем экране.'}
        </span>
      </div>
    </div>
  );
}
