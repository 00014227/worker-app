import { useEffect, useMemo, useState } from 'react';
import { Building2, Mail, Search, RefreshCw, Check, Loader2, Package, BellOff } from 'lucide-react';
import { customersApi, CustomerRow } from '../lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState('');
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  const load = () => {
    setLoading(true);
    customersApi.list().then(setRows).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (onlyConfigured && !c.reportEmails) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.inn ?? '').includes(q) || (c.reportEmails ?? '').toLowerCase().includes(q);
    });
  }, [rows, search, onlyConfigured]);

  const configured = rows.filter((c) => c.reportEmails && c.reportsEnabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Клиенты</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? 'Загрузка…' : `${rows.length} клиентов · рассылка настроена у ${configured}`}
          </p>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        Клиентам с указанным email ежедневно в 11:00 уходит Excel с их перевозками в пути.
        Без email рассылка не идёт.
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Название, ИНН или email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => setOnlyConfigured((v) => !v)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
            onlyConfigured ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          Только с рассылкой
        </button>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <Building2 size={26} className="mx-auto mb-2 opacity-30" />
            {loading ? 'Загрузка…' : 'Клиенты не найдены'}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Клиент</th>
                  <th className="px-4 py-2 text-left font-medium hidden md:table-cell">Email для отчёта</th>
                  <th className="px-4 py-2 text-center font-medium">В пути</th>
                  <th className="px-4 py-2 text-right font-medium">Рассылка</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-xs">{c.name}</div>
                      {c.inn && <div className="text-xs text-muted-foreground">ИНН {c.inn}</div>}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {c.reportEmails ? (
                        <span className="text-xs flex items-center gap-1"><Mail size={11} className="text-muted-foreground" /> {c.reportEmails}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {c.activeOrders > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs"><Package size={11} /> {c.activeOrders}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!c.reportEmails ? (
                        <span className="text-xs text-muted-foreground">не настроена</span>
                      ) : c.reportsEnabled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600"><Check size={12} /> вкл</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600"><BellOff size={12} /> пауза</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <ReportPanel
          customer={selected}
          onClose={() => setSelected(null)}
          onSaved={(u) => {
            setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, ...u } : r)));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function ReportPanel({
  customer, onClose, onSaved,
}: {
  customer: CustomerRow;
  onClose: () => void;
  onSaved: (c: Partial<CustomerRow> & { id: string }) => void;
}) {
  const [emails, setEmails] = useState(customer.reportEmails ?? '');
  const [enabled, setEnabled] = useState(customer.reportsEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await customersApi.updateReports(customer.id, { reportEmails: emails.trim(), reportsEnabled: enabled });
      onSaved({ id: customer.id, reportEmails: res.reportEmails, reportsEnabled: res.reportsEnabled });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm h-full bg-background shadow-xl p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">{customer.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-1 mb-4 text-sm">
          <div className="text-xs text-muted-foreground">ПЕРЕВОЗОК В ПУТИ</div>
          <div>{customer.activeOrders}</div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email для отчёта</Label>
            <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="client@company.com, buh@company.com" />
            <p className="text-xs text-muted-foreground">
              Несколько адресов — через запятую. Пусто = рассылка выключена.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm">Рассылка включена</span>
          </label>
          <p className="text-xs text-muted-foreground -mt-1.5">
            Снимите галочку, чтобы поставить на паузу, не удаляя адреса.
          </p>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <button
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
