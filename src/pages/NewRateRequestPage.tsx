import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Send as SendIcon, Check, Loader2 } from 'lucide-react';
import {
  tenderApi, SupplierRow, TenderMode, TENDER_MODE_LABELS, CreateTenderInput,
} from '../lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MODES: TenderMode[] = ['auto', 'rail', 'air', 'sea'];
const CURRENCIES = ['USD', 'EUR', 'RUB', 'UZS', 'KZT', 'CNY'];

export default function NewRateRequestPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateTenderInput>({ origin: '', destination: '', currency: 'USD' });
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tenderApi.suppliers.list().then(setSuppliers).catch((e) => setError((e as Error).message));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.telegramUsername ?? '').toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  const set = (patch: Partial<CreateTenderInput>) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSave = !!form.origin.trim() && !!form.destination.trim();

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const tender = await tenderApi.tenders.create({
        ...form,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        supplierIds: selected.size ? [...selected] : undefined,
      });
      navigate(`/rate-requests/${tender.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <button
        onClick={() => navigate('/rate-requests')}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
      >
        <ArrowLeft size={13} /> К запросам
      </button>

      <h1 className="text-xl font-bold">Новый запрос ставок</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card>
        <CardContent className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Откуда *</Label>
              <Input value={form.origin} onChange={(e) => set({ origin: e.target.value })} placeholder="Москва" />
            </div>
            <div className="space-y-1.5">
              <Label>Куда *</Label>
              <Input value={form.destination} onChange={(e) => set({ destination: e.target.value })} placeholder="Ташкент" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Тип перевозки</Label>
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set({ mode: form.mode === m ? undefined : m })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    form.mode === m
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {TENDER_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Груз</Label>
              <Input value={form.cargo ?? ''} onChange={(e) => set({ cargo: e.target.value })} placeholder="Оборудование" />
            </div>
            <div className="space-y-1.5">
              <Label>Вес, кг</Label>
              <Input
                type="number"
                value={form.weightKg ?? ''}
                onChange={(e) => set({ weightKg: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="5000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Дата погрузки</Label>
              <Input type="date" value={form.loadingDate ?? ''} onChange={(e) => set({ loadingDate: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Валюта</Label>
              <select
                value={form.currency ?? ''}
                onChange={(e) => set({ currency: e.target.value })}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm outline-none"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Условия / комментарий</Label>
              <Input value={form.conditions ?? ''} onChange={(e) => set({ conditions: e.target.value })} placeholder="Рефрижератор, оплата по факту…" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier picker */}
      <Card>
        <CardContent className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <Label>Подрядчики {selected.size > 0 && <span className="text-primary">· выбрано {selected.size}</span>}</Label>
            <div className="relative w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm" placeholder="Поиск…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Подрядчики не найдены</div>
            ) : (
              filtered.map((s) => {
                const on = selected.has(s.id);
                const noTg = !s.telegramUsername && !s.telegramBound;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                      on ? 'bg-primary/5' : 'hover:bg-muted/40',
                    )}
                  >
                    <span className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      on ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
                    )}>
                      {on && <Check size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium block truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.country ?? '—'}
                        {s.telegramUsername && ` · @${s.telegramUsername.replace('@', '')}`}
                      </span>
                    </span>
                    {noTg && <span className="text-xs text-amber-600 shrink-0">нет Telegram</span>}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Подрядчиков без привязки Telegram отправить не получится — привяжите @username на странице «Подрядчики».
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <button
          disabled={!canSave || saving}
          onClick={submit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <SendIcon size={15} />}
          Создать запрос
        </button>
        <span className="text-xs text-muted-foreground">Отправка подрядчикам — на следующем экране.</span>
      </div>
    </div>
  );
}
