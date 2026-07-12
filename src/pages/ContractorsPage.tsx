import { useEffect, useMemo, useState } from 'react';
import { Users, Send, Search, RefreshCw, Check, Loader2, Clock, Zap, Plus } from 'lucide-react';
import { tenderApi, SupplierRow, TelegramAccountRow, CreateSupplierInput } from '../lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function slaLabel(s: SupplierRow): string | null {
  if (s.responseRate == null && s.avgResponseTimeSec == null) return null;
  const parts: string[] = [];
  if (s.responseRate != null) parts.push(`${Math.round(s.responseRate)}% ответов`);
  if (s.avgResponseTimeSec != null) {
    const min = Math.round(s.avgResponseTimeSec / 60);
    parts.push(min < 60 ? `~${min} мин` : `~${Math.round(min / 60)} ч`);
  }
  return parts.join(' · ');
}

export default function ContractorsPage() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [accounts, setAccounts] = useState<TelegramAccountRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupplierRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    tenderApi.suppliers.list().then(setRows).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    tenderApi.telegramAccounts.list().then(setAccounts).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => c.name.toLowerCase().includes(q) || (c.telegramUsername ?? '').toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Подрядчики</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{loading ? 'Загрузка…' : `${rows.length} компаний`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} /> Добавить подрядчика
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8 h-8 text-sm" placeholder="Поиск по названию или @username…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {filtered.map((c) => {
          const sla = slaLabel(c);
          return (
            <Card
              key={c.id}
              size="sm"
              className={cn('cursor-pointer transition-shadow hover:ring-foreground/20', selected?.id === c.id && 'ring-2 ring-primary')}
              onClick={() => setSelected(c)}
            >
              <CardContent>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.country ?? '—'}</div>
                  </div>
                  {c.telegramBound ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-green-600"><Check size={11} /> TG</span>
                  ) : c.telegramUsername ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-600"><Send size={11} /> привязан</span>
                  ) : (
                    <span className="shrink-0 text-xs text-amber-600">нет TG</span>
                  )}
                </div>
                {(c.telegramUsername || sla) && (
                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-1">
                    {c.telegramUsername && <div className="flex items-center gap-1 text-blue-600"><Send size={11} /> @{c.telegramUsername.replace('@', '')}</div>}
                    {sla && <div className="flex items-center gap-1"><Zap size={11} /> {sla}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            <Users size={26} className="mx-auto mb-2 opacity-30" /> Подрядчики не найдены
          </div>
        )}
      </div>

      {selected && (
        <BindPanel
          supplier={selected}
          accounts={accounts}
          onClose={() => setSelected(null)}
          onSaved={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
            setSelected(null);
          }}
        />
      )}

      {creating && (
        <CreateSupplierPanel
          onClose={() => setCreating(false)}
          onCreated={(row) => {
            setRows((prev) => [row, ...prev]);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CreateSupplierPanel({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (s: SupplierRow) => void;
}) {
  const [form, setForm] = useState<CreateSupplierInput>({ name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<CreateSupplierInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // Trim empties so the backend stores nulls, not blank strings.
      const payload: CreateSupplierInput = { name: form.name.trim() };
      (['telegramUsername', 'telegramUserId', 'country', 'phone', 'email', 'inn', 'code'] as const)
        .forEach((k) => { if (form[k]?.trim()) payload[k] = form[k]!.trim(); });
      const created = await tenderApi.suppliers.create(payload);
      onCreated(created);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm h-full bg-background shadow-xl p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Новый подрядчик</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Название *</Label>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="ТрансЛогист ООО" />
          </div>

          <div className="space-y-1.5">
            <Label>Telegram @username</Label>
            <Input value={form.telegramUsername ?? ''} onChange={(e) => set({ telegramUsername: e.target.value })} placeholder="@contractor" />
            <p className="text-xs text-muted-foreground">Нужно для первого контакта в Telegram.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Telegram ID (числовой)</Label>
            <Input value={form.telegramUserId ?? ''} onChange={(e) => set({ telegramUserId: e.target.value })} placeholder="напр. 123456789" />
            <p className="text-xs text-muted-foreground">Если знаете ID — впишите, тогда ответы сопоставятся сразу.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Страна</Label>
              <Input value={form.country ?? ''} onChange={(e) => set({ country: e.target.value })} placeholder="Казахстан" />
            </div>
            <div className="space-y-1.5">
              <Label>Телефон</Label>
              <Input value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} placeholder="+7…" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email ?? ''} onChange={(e) => set({ email: e.target.value })} placeholder="mail@…" />
            </div>
            <div className="space-y-1.5">
              <Label>ИНН</Label>
              <Input value={form.inn ?? ''} onChange={(e) => set({ inn: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Код компании</Label>
              <Input value={form.code ?? ''} onChange={(e) => set({ code: e.target.value })} />
            </div>
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <button
            onClick={save}
            disabled={!form.name.trim() || saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Создать подрядчика
          </button>
        </div>
      </div>
    </div>
  );
}

function BindPanel({
  supplier, accounts, onClose, onSaved,
}: {
  supplier: SupplierRow;
  accounts: TelegramAccountRow[];
  onClose: () => void;
  onSaved: (s: Partial<SupplierRow> & { id: string }) => void;
}) {
  const [username, setUsername] = useState(supplier.telegramUsername ?? '');
  const [accountId, setAccountId] = useState(supplier.telegramAccountId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!username.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await tenderApi.suppliers.bindTelegram(supplier.id, username.trim(), accountId || undefined);
      onSaved({ id: supplier.id, telegramUsername: username.trim().replace('@', ''), telegramAccountId: accountId || null });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm h-full bg-background shadow-xl p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">{supplier.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-1 mb-4 text-sm">
          <div className="text-xs text-muted-foreground">СТРАНА</div>
          <div>{supplier.country ?? '—'}</div>
        </div>

        {(supplier.responseRate != null || supplier.avgResponseTimeSec != null) && (
          <div className="mb-4 rounded-lg border p-3 text-xs space-y-1">
            <div className="text-muted-foreground flex items-center gap-1"><Clock size={11} /> SLA</div>
            {supplier.responseRate != null && <div>Отвечает: {Math.round(supplier.responseRate)}%</div>}
            {supplier.avgResponseTimeSec != null && <div>Среднее время: ~{Math.round(supplier.avgResponseTimeSec / 60)} мин</div>}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Telegram @username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@contractor" />
            <p className="text-xs text-muted-foreground">Нужно для первого контакта. Дальше система запомнит подрядчика по его ID.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Аккаунт рассылки (необязательно)</Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm outline-none"
            >
              <option value="">Авто-выбор</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} ({a.phone})</option>)}
            </select>
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <button
            onClick={save}
            disabled={!username.trim() || saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
