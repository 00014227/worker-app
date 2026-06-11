import { useId } from 'react';
import {
  Truck, Plane, Train, Ship, Plus, Trash2,
  Package, MapPin, FileText, Hash, User, MessageSquare,
  Layers, ClipboardList, Boxes, BarChart2, ArrowDown, Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export const TRANSPORT_TYPES = [
  { value: 'Авто',                          label: 'Авто',         icon: Truck,         color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { value: 'Авиа',                          label: 'Авиа',         icon: Plane,         color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { value: 'Железнодорожная',               label: 'Ж/Д',          icon: Train,         color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { value: 'Мультимодальная',               label: 'Мульти',       icon: Layers,        color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { value: 'Кодовая',                       label: 'Кодовая',      icon: Hash,          color: 'text-pink-600 bg-pink-50 border-pink-200' },
  { value: 'ТаможенноеОформление',          label: 'Таможня',      icon: ClipboardList, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'СкладскаяЛогистика',           label: 'Склад',        icon: Boxes,         color: 'text-lime-600 bg-lime-50 border-lime-200' },
  { value: 'СборнаяАвтоПеревозка',         label: 'Сб. авто',     icon: Truck,         color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { value: 'СборнаяКонтейнернаяПеревозка', label: 'Сб. конт.',    icon: Package,       color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { value: 'КурьерскиеУслуги',             label: 'Курьер',       icon: BarChart2,     color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
];

// Leg types available within a multimodal segment
const LEG_TYPES = [
  { value: 'Авто',   label: 'Авто',  icon: Truck, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { value: 'Авиа',   label: 'Авиа',  icon: Plane, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { value: 'ЖД',     label: 'Ж/Д',   icon: Train, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { value: 'Море',   label: 'Море',  icon: Ship,  color: 'text-blue-600 bg-blue-50 border-blue-200' },
];

export const STATUSES = ['В работе', 'В пути', 'На таможне', 'Задержка', 'Доставлен', 'Завершена', 'Отменена'];

export const OFFICES = [
  'Ташкент',
  'Москва',
  'Алматы',
  'Бишкек',
  'Душанбе',
  'Ашхабад',
  'Баку',
  'Тбилиси',
  'Минск',
  'Новосибирск',
];

export interface Leg {
  id: string;
  type: string;
  departure: string;
  destination: string;
  departureDatePlan: string;
  arrivalDatePlan: string;
  carrier: string;
  waybillNumber: string;
  vehicleNumbers: string;
  notes: string;
  officeName: string;
}

export interface ShipmentFormData {
  transportationType: string;
  postingDate: string;
  clientOrderNumber: string;
  status: string;
  payer: string;
  customer: string;
  departure: string;
  destination: string;
  departureDatePlan: string;
  departureDateActual: string;
  arrivalDatePlan: string;
  arrivalDateActual: string;
  declaredWeight: string;
  actualWeight: string;
  vehicleCount: string;
  vehicleNumbers: string;
  waybillNumber: string;
  currentLocation: string;
  tracingComment: string;
  responsible: string;
  keyAccountManager: string;
  comment: string;
  legs: Leg[];
}

export const emptyForm: ShipmentFormData = {
  transportationType: '',
  postingDate: new Date().toISOString().slice(0, 10),
  clientOrderNumber: '',
  status: 'В работе',
  payer: '',
  customer: '',
  departure: '',
  destination: '',
  departureDatePlan: '',
  departureDateActual: '',
  arrivalDatePlan: '',
  arrivalDateActual: '',
  declaredWeight: '',
  actualWeight: '',
  vehicleCount: '',
  vehicleNumbers: '',
  waybillNumber: '',
  currentLocation: '',
  tracingComment: '',
  responsible: '',
  keyAccountManager: '',
  comment: '',
  legs: [],
};

function newLeg(prefillDeparture = ''): Leg {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'Авто',
    departure: prefillDeparture,
    destination: '',
    departureDatePlan: '',
    arrivalDatePlan: '',
    carrier: '',
    waybillNumber: '',
    vehicleNumbers: '',
    notes: '',
    officeName: '',
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon size={14} className="text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ── Leg editor ───────────────────────────────────────────────────────────────

function LegEditor({ leg, index, total, onChange, onDelete }: {
  leg: Leg;
  index: number;
  total: number;
  onChange: (updated: Leg) => void;
  onDelete: () => void;
}) {
  const set = <K extends keyof Leg>(key: K, val: string) => onChange({ ...leg, [key]: val });
  const t = LEG_TYPES.find(t => t.value === leg.type);

  return (
    <div className="rounded-xl border bg-muted/20 overflow-hidden">
      {/* Leg header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Этап {index + 1}</span>
          {leg.officeName && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Building2 size={10} />
              {leg.officeName}
            </span>
          )}
        </div>
        {total > 1 && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Type picker */}
        <div className="flex gap-2">
          {LEG_TYPES.map(lt => {
            const Icon = lt.icon;
            const active = leg.type === lt.value;
            return (
              <button
                key={lt.value}
                onClick={() => set('type', lt.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  active ? lt.color + ' border-current' : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground',
                )}
              >
                <Icon size={13} />
                {lt.label}
              </button>
            );
          })}
        </div>

        {/* Office */}
        <Field label="Ответственный офис">
          <div className="flex flex-wrap gap-1.5">
            {OFFICES.map(office => (
              <button
                key={office}
                type="button"
                onClick={() => set('officeName', leg.officeName === office ? '' : office)}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-xs font-medium transition-all',
                  leg.officeName === office
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                )}
              >
                {office}
              </button>
            ))}
            <Input
              className="h-7 w-28 text-xs"
              placeholder="Другой..."
              value={OFFICES.includes(leg.officeName) ? '' : leg.officeName}
              onChange={e => set('officeName', e.target.value)}
            />
          </div>
        </Field>

        {/* Route */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Откуда" required>
            <Input value={leg.departure} onChange={e => set('departure', e.target.value)} placeholder="Город / порт / аэропорт" />
          </Field>
          <Field label="Куда" required>
            <Input value={leg.destination} onChange={e => set('destination', e.target.value)} placeholder="Город / порт / аэропорт" />
          </Field>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата отправления (план)">
            <Input type="date" value={leg.departureDatePlan} onChange={e => set('departureDatePlan', e.target.value)} />
          </Field>
          <Field label="Дата прибытия (план)">
            <Input type="date" value={leg.arrivalDatePlan} onChange={e => set('arrivalDatePlan', e.target.value)} />
          </Field>
        </div>

        {/* Type-specific */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={
            leg.type === 'Авиа' ? 'Авиакомпания / рейс' :
            leg.type === 'Море' ? 'Судоходная линия / судно' :
            leg.type === 'ЖД'   ? 'Перевозчик / ж/д оператор' :
            'Перевозчик'
          }>
            <Input value={leg.carrier} onChange={e => set('carrier', e.target.value)}
              placeholder={
                leg.type === 'Авиа' ? 'Uzbekistan Airways, HY 101' :
                leg.type === 'Море' ? 'COSCO, EVER GIVEN' :
                leg.type === 'ЖД'   ? 'РЖД, УТЙ' :
                'ИП Иванов'
              }
            />
          </Field>
          <Field label={
            leg.type === 'Авиа' ? 'Номер AWB' :
            leg.type === 'Море' ? 'Номер коносамента (B/L)' :
            leg.type === 'ЖД'   ? 'Номер ж/д накладной' :
            'Номер накладной / CMR'
          }>
            <Input value={leg.waybillNumber} onChange={e => set('waybillNumber', e.target.value)}
              placeholder={
                leg.type === 'Авиа' ? '555-12345678' :
                leg.type === 'Море' ? 'COSU1234567890' :
                leg.type === 'ЖД'   ? 'ЭЙ 123456' :
                'CMR-001'
              }
            />
          </Field>
        </div>

        {/* Vehicle/container numbers */}
        {(leg.type === 'Авто' || leg.type === 'ЖД' || leg.type === 'Море') && (
          <Field label={
            leg.type === 'Море' ? 'Номера контейнеров' :
            leg.type === 'ЖД'   ? 'Номера вагонов / контейнеров' :
            'Номера ТС'
          }>
            <Input value={leg.vehicleNumbers} onChange={e => set('vehicleNumbers', e.target.value)}
              placeholder={
                leg.type === 'Море' ? 'MRKU1234567, TGHU9876543' :
                leg.type === 'ЖД'   ? '94012345, 94056789' :
                'А123БВ 77, Б456ГД 50'
              }
            />
          </Field>
        )}

        {/* Notes */}
        <Field label="Примечание к этапу">
          <Input value={leg.notes} onChange={e => set('notes', e.target.value)} placeholder="Доп. информация..." />
        </Field>
      </div>
    </div>
  );
}

// ── Main form body ────────────────────────────────────────────────────────────

interface Props {
  form: ShipmentFormData;
  onChange: (updated: ShipmentFormData) => void;
}

export default function ShipmentForm({ form, onChange }: Props) {
  const set = <K extends keyof ShipmentFormData>(key: K, val: string) =>
    onChange({ ...form, [key]: val });

  const isMulti   = form.transportationType === 'Мультимодальная';
  const isAuto    = ['Авто', 'СборнаяАвтоПеревозка'].includes(form.transportationType);
  const isAvia    = form.transportationType === 'Авиа';
  const isRail    = ['Железнодорожная', 'СборнаяКонтейнернаяПеревозка'].includes(form.transportationType);
  const showVehicles = isAuto;
  const showWeight   = !['ТаможенноеОформление', 'СкладскаяЛогистика'].includes(form.transportationType);

  // Multimodal leg helpers
  const updateLeg = (i: number, updated: Leg) => {
    const legs = [...form.legs];
    legs[i] = updated;
    // Auto-sync first leg departure → form departure, last leg destination → form destination
    onChange({
      ...form,
      legs,
      departure: legs[0]?.departure || form.departure,
      destination: legs[legs.length - 1]?.destination || form.destination,
    });
  };

  const addLeg = () => {
    const prev = form.legs[form.legs.length - 1];
    onChange({ ...form, legs: [...form.legs, newLeg(prev?.destination ?? '')] });
  };

  const deleteLeg = (i: number) => {
    const legs = form.legs.filter((_, idx) => idx !== i);
    onChange({ ...form, legs });
  };

  return (
    <div className="space-y-5">

      {/* Transport type selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers size={14} className="text-muted-foreground" />
            Тип перевозки <span className="text-red-500">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {TRANSPORT_TYPES.map(t => {
              const Icon = t.icon;
              const active = form.transportationType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    const next = active ? '' : t.value;
                    // Init legs when switching to multimodal
                    const legs = next === 'Мультимодальная' && form.legs.length === 0
                      ? [newLeg(form.departure)]
                      : next !== 'Мультимодальная' ? [] : form.legs;
                    onChange({ ...form, transportationType: next, legs });
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all',
                    active
                      ? t.color + ' border-current'
                      : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon size={18} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {form.transportationType && (
        <>
          {/* Main info */}
          <Section icon={FileText} title="Основная информация">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Дата проводки">
                <Input type="date" value={form.postingDate} onChange={e => set('postingDate', e.target.value)} />
              </Field>
              <Field label="Номер заказа клиента">
                <Input value={form.clientOrderNumber} onChange={e => set('clientOrderNumber', e.target.value)} placeholder="CLT-0001" />
              </Field>
              <Field label="Статус">
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Плательщик">
                <Input value={form.payer} onChange={e => set('payer', e.target.value)} placeholder="Название компании" />
              </Field>
              <Field label="Клиент">
                <Input value={form.customer} onChange={e => set('customer', e.target.value)} placeholder="Конечный получатель" />
              </Field>
            </div>
          </Section>

          {/* ── MULTIMODAL: legs builder ─────────────────────────── */}
          {isMulti ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers size={14} className="text-muted-foreground" />
                  Этапы маршрута
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.legs.map((leg, i) => (
                  <div key={leg.id}>
                    <LegEditor
                      leg={leg}
                      index={i}
                      total={form.legs.length}
                      onChange={updated => updateLeg(i, updated)}
                      onDelete={() => deleteLeg(i)}
                    />
                    {i < form.legs.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="flex flex-col items-center gap-0.5 text-muted-foreground/40">
                          <ArrowDown size={14} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addLeg}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus size={14} /> Добавить этап
                </button>

                {/* Summary route from legs */}
                {form.legs.length > 0 && (
                  <div className="rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Общий маршрут: </span>
                    {form.legs.map((l, i) => (
                      <span key={l.id}>
                        {i === 0 && l.departure && <span className="font-medium text-foreground">{l.departure}</span>}
                        {l.destination && (
                          <>
                            <span className="mx-1">→</span>
                            <span className="font-medium text-foreground">{l.destination}</span>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* ── REGULAR: single route ─────────────────────────── */
            <Section icon={MapPin} title="Маршрут">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Откуда" required>
                  <Input value={form.departure} onChange={e => set('departure', e.target.value)} placeholder="Ташкент" />
                </Field>
                <Field label="Куда" required>
                  <Input value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="Москва" />
                </Field>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <Field label="Отправление (план)">
                  <Input type="date" value={form.departureDatePlan} onChange={e => set('departureDatePlan', e.target.value)} />
                </Field>
                <Field label="Отправление (факт)">
                  <Input type="date" value={form.departureDateActual} onChange={e => set('departureDateActual', e.target.value)} />
                </Field>
                <Field label="Прибытие (план)">
                  <Input type="date" value={form.arrivalDatePlan} onChange={e => set('arrivalDatePlan', e.target.value)} />
                </Field>
                <Field label="Прибытие (факт)">
                  <Input type="date" value={form.arrivalDateActual} onChange={e => set('arrivalDateActual', e.target.value)} />
                </Field>
              </div>
            </Section>
          )}

          {/* Cargo */}
          {showWeight && (
            <Section icon={Package} title="Груз">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Заявленный вес, кг">
                  <Input type="number" min={0} value={form.declaredWeight} onChange={e => set('declaredWeight', e.target.value)} placeholder="5000" />
                </Field>
                <Field label="Фактический вес, кг">
                  <Input type="number" min={0} value={form.actualWeight} onChange={e => set('actualWeight', e.target.value)} placeholder="4980" />
                </Field>
              </div>
            </Section>
          )}

          {/* Vehicles — Авто only (not multimodal, handled per-leg) */}
          {showVehicles && (
            <Section icon={Truck} title="Транспортные средства">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Количество ТС">
                  <Input type="number" min={1} value={form.vehicleCount} onChange={e => set('vehicleCount', e.target.value)} placeholder="1" />
                </Field>
                <Field label="Номера ТС">
                  <Input value={form.vehicleNumbers} onChange={e => set('vehicleNumbers', e.target.value)} placeholder="А123БВ 77, Б456ГД 50" />
                </Field>
              </div>
              <Field label="Номер накладной / CMR">
                <Input value={form.waybillNumber} onChange={e => set('waybillNumber', e.target.value)} placeholder="CMR-2026-001" />
              </Field>
            </Section>
          )}

          {isAvia && (
            <Section icon={Plane} title="Авиаперевозка">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Номер авианакладной (AWB)">
                  <Input value={form.waybillNumber} onChange={e => set('waybillNumber', e.target.value)} placeholder="555-12345678" />
                </Field>
                <Field label="Авиакомпания / рейс">
                  <Input value={form.tracingComment} onChange={e => set('tracingComment', e.target.value)} placeholder="HY 101 / Uzbekistan Airways" />
                </Field>
              </div>
            </Section>
          )}

          {isRail && (
            <Section icon={Train} title="Ж/Д перевозка">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Номер ж/д накладной">
                  <Input value={form.waybillNumber} onChange={e => set('waybillNumber', e.target.value)} placeholder="ЭЙ 123456" />
                </Field>
                <Field label="Кол-во вагонов / контейнеров">
                  <Input type="number" min={1} value={form.vehicleCount} onChange={e => set('vehicleCount', e.target.value)} placeholder="1" />
                </Field>
              </div>
              <Field label="Номера вагонов / контейнеров">
                <Input value={form.vehicleNumbers} onChange={e => set('vehicleNumbers', e.target.value)} placeholder="MRKU1234567" />
              </Field>
            </Section>
          )}

          {/* Tracking */}
          <Section icon={MapPin} title="Отслеживание">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Текущее местоположение">
                <Input value={form.currentLocation} onChange={e => set('currentLocation', e.target.value)} placeholder="Алматы, Казахстан" />
              </Field>
              {!isAvia && !isRail && !isMulti && (
                <Field label="Комментарий трейсинга">
                  <Input value={form.tracingComment} onChange={e => set('tracingComment', e.target.value)} placeholder="Пересек границу 01.06" />
                </Field>
              )}
            </div>
          </Section>

          {/* Responsible */}
          <Section icon={User} title="Ответственные">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ответственный">
                <Input value={form.responsible} onChange={e => set('responsible', e.target.value)} placeholder="Иванов И.И." />
              </Field>
              <Field label="Ключевой аккаунт-менеджер">
                <Input value={form.keyAccountManager} onChange={e => set('keyAccountManager', e.target.value)} placeholder="Петров П.П." />
              </Field>
            </div>
          </Section>

          {/* Comment */}
          <Section icon={MessageSquare} title="Комментарий">
            <Textarea
              value={form.comment}
              onChange={e => set('comment', e.target.value)}
              placeholder="Дополнительная информация о перевозке..."
              className="min-h-[80px] resize-none"
            />
          </Section>
        </>
      )}
    </div>
  );
}
