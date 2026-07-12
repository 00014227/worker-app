import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Loader2, Send, KeyRound, Phone, Check } from 'lucide-react';
import { tenderApi, TelegramAccountRow } from '../lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUS: Record<TelegramAccountRow['status'], { label: string; cls: string }> = {
  active:    { label: 'Активен',   cls: 'bg-green-50 text-green-700 border-green-200' },
  cooldown:  { label: 'Пауза',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  blocked:   { label: 'Заблокирован', cls: 'bg-red-50 text-red-700 border-red-200' },
  loggedout: { label: 'Не в сети', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function TelegramAccountsPage() {
  const [rows, setRows] = useState<TelegramAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    tenderApi.telegramAccounts.list().then(setRows).finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Telegram-аккаунты</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? 'Загрузка…' : `${rows.length} аккаунтов для рассылки подрядчикам`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowAdd((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus size={13} /> Добавить
          </button>
        </div>
      </div>

      {showAdd && <AddAccount onDone={() => { setShowAdd(false); load(); }} />}

      <div className="space-y-2.5">
        {rows.map((a) => <AccountRow key={a.id} account={a} onChange={load} />)}
        {!loading && rows.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Аккаунтов нет</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function AddAccount({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ label: '', phone: '', apiId: '', apiHash: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await tenderApi.telegramAccounts.create({
        label: form.label.trim(),
        phone: form.phone.trim(),
        apiId: Number(form.apiId),
        apiHash: form.apiHash.trim(),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const ok = form.label && form.phone && form.apiId && form.apiHash;
  return (
    <Card>
      <CardHeader className="border-b pb-3"><CardTitle className="text-sm">Новый аккаунт</CardTitle></CardHeader>
      <CardContent className="pt-1 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Название</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Рассылка 1" /></div>
          <div className="space-y-1.5"><Label>Телефон</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+9989..." /></div>
          <div className="space-y-1.5"><Label>API ID</Label><Input value={form.apiId} onChange={(e) => setForm({ ...form, apiId: e.target.value })} placeholder="1234567" /></div>
          <div className="space-y-1.5"><Label>API Hash</Label><Input value={form.apiHash} onChange={(e) => setForm({ ...form, apiHash: e.target.value })} placeholder="abcdef..." /></div>
        </div>
        <p className="text-xs text-muted-foreground">API ID / Hash получаются на my.telegram.org. После создания нажмите «Войти» для авторизации по коду.</p>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button onClick={submit} disabled={!ok || saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Создать
        </button>
      </CardContent>
    </Card>
  );
}

function AccountRow({ account, onChange }: { account: TelegramAccountRow; onChange: () => void }) {
  const st = STATUS[account.status];
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await tenderApi.telegramAccounts.sendCode(account.id);
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await tenderApi.telegramAccounts.verify(account.id, code.trim());
      setDone(true);
      setStep('idle');
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Phone size={14} className="text-muted-foreground shrink-0" />
            <span className="font-medium text-sm">{account.label}</span>
            <span className="text-xs text-muted-foreground">{account.phone}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Сегодня: {account.dailySentCount}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', st.cls)}>{st.label}</span>
            {(account.status === 'loggedout' || account.status === 'blocked') && step === 'idle' && (
              <button onClick={sendCode} disabled={busy} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted/50 disabled:opacity-40 transition-colors">
                {busy ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />} Войти
              </button>
            )}
            {done && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> готово</span>}
          </div>
        </div>

        {account.status === 'cooldown' && account.floodWaitUntil && (
          <div className="text-xs text-amber-600">Пауза до {new Date(account.floodWaitUntil).toLocaleString('ru-RU')}</div>
        )}

        {step === 'code' && (
          <div className="flex items-center gap-2 pt-1">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код из Telegram" className="h-8 max-w-[180px]" />
            <button onClick={verify} disabled={busy || !code.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Подтвердить
            </button>
            <button onClick={() => setStep('idle')} className="text-xs text-muted-foreground hover:text-foreground">Отмена</button>
          </div>
        )}

        {error && <div className="text-xs text-red-600">{error}</div>}
      </CardContent>
    </Card>
  );
}
