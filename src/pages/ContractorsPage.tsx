import { useEffect, useMemo, useState } from 'react';
import { Users, Send, Search, RefreshCw, Check, Loader2, Clock, Zap, Plus, Mail, Globe, ShieldCheck, PhoneCall, AlertTriangle, Trash2 } from 'lucide-react';
import {
  tenderApi, SupplierRow, TelegramAccountRow, CreateSupplierInput,
  ContactChannel, CONTACT_CHANNEL_LABELS,
  ContactLanguage, CONTACT_LANGUAGE_LABELS,
} from '../lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { confirmOnStand } from '../lib/env';

const CHANNELS: ContactChannel[] = ['telegram', 'email', 'both'];
const LANGUAGES: ContactLanguage[] = ['RU', 'EN', 'UZ'];
const MODES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Авто' },
  { value: 'rail', label: 'Ж/Д' },
  { value: 'air', label: 'Авиа' },
  { value: 'sea', label: 'Море' },
];
const MODE_LABEL: Record<string, string> = Object.fromEntries(MODES.map((m) => [m.value, m.label]));

/** «Россия, Казахстан» ⇄ ['Россия','Казахстан'] — ввод через запятую, как у ТНВЭД. */
const parseList = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean);

/** Переключатели видов транспорта — общие для формы создания и редактирования. */
function ModePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (m: string) =>
    onChange(value.includes(m) ? value.filter((v) => v !== m) : [...value, m]);
  return (
    <div className="flex gap-2 flex-wrap">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => toggle(m.value)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
            value.includes(m.value)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** Small segmented channel selector reused by create + bind panels. */
function ChannelSelect({ value, onChange }: { value: ContactChannel; onChange: (c: ContactChannel) => void }) {
  return (
    <div className="flex gap-2">
      {CHANNELS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all',
            value === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          {CONTACT_CHANNEL_LABELS[c]}
        </button>
      ))}
    </div>
  );
}

/** Segmented language selector — the language outbound tender messages go out in. */
function LangSelect({ value, onChange }: { value: ContactLanguage; onChange: (l: ContactLanguage) => void }) {
  return (
    <div className="flex gap-2">
      {LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={cn(
            'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all',
            value === l ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          {CONTACT_LANGUAGE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

/**
 * Можно ли вообще написать подрядчику. Для Telegram юзербот умеет писать только
 * по @username: одного числового ID мало — нужен access hash, который выдаётся
 * при поиске по телефону или после входящего сообщения.
 */
/**
 * Есть ли вообще способ связаться. Достижимость в Telegram — это @username ИЛИ
 * успешный поиск по телефону: последний импортирует контакт и даёт access_hash,
 * после чего мы пишем по числовому ID. Из 70 найденных публичный username есть
 * у 34 — приравнивать «нет username» к «нет связи» значит зря пугать логиста.
 */
function hasNoContact(s: SupplierRow): boolean {
  const tgOk = !!s.telegramUsername || !!s.telegramResolved;
  const mailOk = !!s.email;
  if (s.contactChannel === 'email') return !mailOk;
  if (s.contactChannel === 'both') return !tgOk && !mailOk;
  return !tgOk;
}

/**
 * Цвет рейтинга надёжности. Отсутствие рейтинга (null) — это «не проверен», а не
 * «плохой»: новичок без истории не должен выглядеть хуже, чем сорвавший рейс.
 */
function reliabilityCls(score: number): string {
  if (score >= 80) return 'bg-green-50 text-green-700 border-green-200';
  if (score >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

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
  const [resolving, setResolving] = useState(false);
  const [resolveInfo, setResolveInfo] = useState<string | null>(null);
  /** Быстрые фильтры: всё | доступные | без связи | без направлений. */
  const [tab, setTab] = useState<'all' | 'ready' | 'nocontact' | 'nodir'>('all');
  const [dir, setDir] = useState('');
  /** Только что добавленный — держим наверху, иначе он тонет среди сотни. */
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    tenderApi.suppliers.list().then(setRows).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    tenderApi.telegramAccounts.list().then(setAccounts).catch(() => {});
  }, []);

  /** Список направлений для фильтра — берём из самих подрядчиков. */
  const allDirections = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((c) => c.directions.forEach((d) => set.add(d)));
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Телефон логист помнит цифрами, а записан он с плюсом и скобками —
    // сравниваем только цифры, иначе поиск по номеру не работает.
    const digits = q.replace(/\D/g, '');
    let out = rows;

    if (q) {
      out = out.filter((c) => {
        const haystack = [
          c.name,
          c.telegramUsername ?? '',
          c.email ?? '',
          c.country ?? '',
          ...c.directions,
        ]
          .join(' ')
          .toLowerCase();
        if (haystack.includes(q)) return true;
        return digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits);
      });
    }

    if (dir) out = out.filter((c) => c.directions.includes(dir));
    if (tab === 'ready') out = out.filter((c) => !hasNoContact(c));
    if (tab === 'nocontact') out = out.filter(hasNoContact);
    if (tab === 'nodir') out = out.filter((c) => c.directions.length === 0);

    // Новый подрядчик — наверх: сразу после создания его надо дозаполнить,
    // а в алфавитном списке из сотни он теряется мгновенно.
    if (justAdded) {
      const i = out.findIndex((c) => c.id === justAdded);
      if (i > 0) out = [out[i], ...out.slice(0, i), ...out.slice(i + 1)];
    }
    return out;
  }, [rows, search, dir, tab, justAdded]);

  const noContact = rows.filter(hasNoContact).length;
  const needResolve = rows.filter((c) => c.phone && !c.telegramUsername && !c.telegramResolved).length;

  /**
   * Ищет подрядчиков в Telegram по телефонам. Массовый импорт контактов Telegram
   * считает спам-поведением, поэтому первый прогон стоит делать на нескольких.
   */
  const resolvePhones = async () => {
    if (
      !confirmOnStand(
        'Номера будут добавлены в контакты рабочего Telegram-аккаунта — массовый импорт Telegram считает спамом.',
      )
    )
      return;
    setResolving(true);
    setResolveInfo(null);
    try {
      const r = await tenderApi.suppliers.resolveByPhone();
      const s = r.summary;
      const dup = r.results.find((x) => x.status === 'duplicate');
      setResolveInfo(
        `Проверено ${s.total}: найдено ${s.resolved} (username ${s.withUsername}), ` +
          `скрыто приватностью ${s.notFound}, чужой номер ${s.idMismatch}` +
          (s.duplicate ? `, дубль ${s.duplicate}` : '') +
          (s.errors ? `, ошибок ${s.errors}` : '') +
          (dup?.note ? ` — ${dup.note}` : ''),
      );
      load();
    } catch (e) {
      setResolveInfo((e as Error).message);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Подрядчики</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? 'Загрузка…' : `${rows.length} компаний`}
            {!loading && noContact > 0 && (
              <span className="text-amber-700"> · без способа связи {noContact}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          {needResolve > 0 && (
            <button
              onClick={resolvePhones}
              disabled={resolving}
              title="Telegram найдёт подрядчиков по номеру и вернёт @username — после этого им можно писать"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 disabled:opacity-40 transition-colors"
            >
              {resolving ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}
              Найти по телефонам ({needResolve})
            </button>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} /> Добавить подрядчика
          </button>
        </div>
      </div>

      {resolveInfo && (
        <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-xs">{resolveInfo}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Название, @username, телефон, страна, направление…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Разрезы, по которым логист ищет чаще всего. Счётчики сразу говорят,
            сколько подрядчиков в каждом — не приходится проверять вслепую. */}
        {([
          ['all', 'Все', rows.length],
          ['ready', 'Со связью', rows.length - noContact],
          ['nocontact', 'Без связи', noContact],
          ['nodir', 'Без направлений', rows.filter((c) => c.directions.length === 0).length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
              tab === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted/50',
            )}
          >
            {label} <span className="opacity-70">{count}</span>
          </button>
        ))}

        {allDirections.length > 0 && (
          <select
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none"
          >
            <option value="">Любое направление</option>
            {allDirections.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}

        {(search || dir || tab !== 'all') && (
          <button
            onClick={() => { setSearch(''); setDir(''); setTab('all'); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Сбросить
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          показано {filtered.length} из {rows.length}
        </span>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Ничего не нашлось. Попробуйте часть названия, номер телефона или сбросьте фильтры.
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {filtered.map((c) => {
          const sla = slaLabel(c);
          return (
            <Card
              key={c.id}
              size="sm"
              className={cn(
                'cursor-pointer transition-shadow hover:ring-foreground/20',
                selected?.id === c.id && 'ring-2 ring-primary',
                justAdded === c.id && 'ring-2 ring-green-500',
              )}
              onClick={() => setSelected(c)}
            >
              <CardContent>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {c.name}
                      {justAdded === c.id && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium align-middle">
                          новый
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.country ?? '—'}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                      {CONTACT_CHANNEL_LABELS[c.contactChannel] ?? c.contactChannel}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-xs text-primary font-medium">
                      {c.preferredLanguage}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-1">
                  {/* Направления показываем всегда: пустые сразу видно — такие не подберутся автоматически */}
                  <div className={cn('flex items-start gap-1', c.directions.length === 0 && 'text-amber-600')}>
                    <Globe size={11} className="mt-0.5 shrink-0" />
                    <span className="truncate">
                      {c.directions.length > 0 ? c.directions.join(', ') : 'направления не заданы'}
                      {c.transportModes.length > 0 && ` · ${c.transportModes.map((m) => MODE_LABEL[m] ?? m).join('/')}`}
                    </span>
                  </div>
                  {c.telegramUsername && <div className="flex items-center gap-1 text-blue-600"><Send size={11} /> @{c.telegramUsername.replace('@', '')}</div>}
                  {hasNoContact(c) && (
                    <div className="flex items-center gap-1 text-amber-700">
                      <AlertTriangle size={11} className="shrink-0" />
                      {c.phone ? 'не найден в Telegram — проверьте номер' : 'нет способа связи: добавьте телефон'}
                    </div>
                  )}
                  {c.email && <div className="flex items-center gap-1"><Mail size={11} /> {c.email}</div>}
                  {c.phone && <div className="flex items-center gap-1"><PhoneCall size={11} /> {c.phone}</div>}
                  {sla && <div className="flex items-center gap-1"><Zap size={11} /> {sla}</div>}
                  {/* Надёжность: считается по выполненным подтверждениям, поэтому
                      у новых подрядчиков честно пусто, а не ноль. */}
                  {c.scorecard && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <ShieldCheck size={11} className="shrink-0" />
                      {c.scorecard.reliability != null ? (
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border', reliabilityCls(c.scorecard.reliability))}>
                          надёжность {c.scorecard.reliability}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border">
                          не проверен
                        </span>
                      )}
                      <span className="truncate">{c.scorecard.note}</span>
                    </div>
                  )}
                  {c.scorecard && (c.scorecard.invites > 0 || c.scorecard.wins > 0) && (
                    <div className="text-[11px] text-muted-foreground/80">
                      приглашений {c.scorecard.invites} · ответов {c.scorecard.replies} · перевозок {c.scorecard.wins}
                      {c.scorecard.breaks > 0 && <span className="text-red-600"> · срывов {c.scorecard.breaks}</span>}
                    </div>
                  )}
                </div>
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
          onDeleted={(id) => {
            setRows((prev) => prev.filter((r) => r.id !== id));
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
            // Новый подрядчик закрепляется наверху с пометкой и сразу
            // открывается на правку: без направлений и телефона он бесполезен —
            // в автоподбор не попадёт и написать ему будет нечем.
            setJustAdded(row.id);
            setSearch('');
            setDir('');
            setTab('all');
            setSelected(row);
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
  const [form, setForm] = useState<CreateSupplierInput>({ name: '', contactChannel: 'telegram', preferredLanguage: 'RU' });
  const [directions, setDirections] = useState('');
  const [modes, setModes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<CreateSupplierInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // Trim empties so the backend stores nulls, not blank strings.
      const payload: CreateSupplierInput = {
        name: form.name.trim(),
        contactChannel: form.contactChannel,
        preferredLanguage: form.preferredLanguage,
        directions: parseList(directions),
        transportModes: modes,
      };
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
            <Label>Канал связи</Label>
            <ChannelSelect value={form.contactChannel ?? 'telegram'} onChange={(c) => set({ contactChannel: c })} />
            <p className="text-xs text-muted-foreground">По этому каналу пойдёт рассылка тендеров. Для «Почта» заполните email, для Telegram — @username.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Язык общения</Label>
            <LangSelect value={form.preferredLanguage ?? 'RU'} onChange={(l) => set({ preferredLanguage: l })} />
            <p className="text-xs text-muted-foreground">Запросы, напоминания и уведомления будут уходить на этом языке.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Направления (страны)</Label>
            <Input value={directions} onChange={(e) => setDirections(e.target.value)} placeholder="Россия, Казахстан, Узбекистан" />
            <p className="text-xs text-muted-foreground">
              Через запятую. По ним запрос будет автоматически подбирать подрядчиков под маршрут.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Виды транспорта</Label>
            <ModePicker value={modes} onChange={setModes} />
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
  supplier, accounts, onClose, onSaved, onDeleted,
}: {
  supplier: SupplierRow;
  accounts: TelegramAccountRow[];
  onClose: () => void;
  onSaved: (s: Partial<SupplierRow> & { id: string }) => void;
  onDeleted: (id: string) => void;
}) {
  const [username, setUsername] = useState(supplier.telegramUsername ?? '');
  const [email, setEmail] = useState(supplier.email ?? '');
  const [phone, setPhone] = useState(supplier.phone ?? '');
  const [channel, setChannel] = useState<ContactChannel>(supplier.contactChannel ?? 'telegram');
  const [language, setLanguage] = useState<ContactLanguage>(supplier.preferredLanguage ?? 'RU');
  const [directions, setDirections] = useState((supplier.directions ?? []).join(', '));
  const [modes, setModes] = useState<string[]>(supplier.transportModes ?? []);
  const [accountId, setAccountId] = useState(supplier.telegramAccountId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Удаление необратимо, поэтому подтверждается вторым нажатием: отдельная
  // модалка ради одной кнопки избыточна, но снести подрядчика одним кликом нельзя.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await tenderApi.suppliers.remove(supplier.id);
      onDeleted(supplier.id);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const dirs = parseList(directions);
      await tenderApi.suppliers.update(supplier.id, {
        telegramUsername: username.trim() || undefined,
        email: email.trim() || undefined,
        phone,
        contactChannel: channel,
        preferredLanguage: language,
        directions: dirs,
        transportModes: modes,
        telegramAccountId: accountId || undefined,
      });
      onSaved({
        id: supplier.id,
        telegramUsername: username.trim().replace('@', '') || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        contactChannel: channel,
        preferredLanguage: language,
        directions: dirs,
        transportModes: modes,
        telegramAccountId: accountId || null,
      });
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

        {/* Надёжность и история — то, на что смотрят, решая, звать ли подрядчика. */}
        {supplier.scorecard && (
          <div className="mb-4 rounded-lg border p-3 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1"><ShieldCheck size={11} /> Надёжность</span>
              {supplier.scorecard.reliability != null ? (
                <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium border', reliabilityCls(supplier.scorecard.reliability))}>
                  {supplier.scorecard.reliability} / 100
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[11px] bg-muted text-muted-foreground border">не проверен</span>
              )}
            </div>
            <p className="text-muted-foreground">{supplier.scorecard.note}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 border-t">
              <span className="text-muted-foreground">Приглашений</span>
              <span className="text-right">{supplier.scorecard.invites}</span>
              <span className="text-muted-foreground">Ответов</span>
              <span className="text-right">{supplier.scorecard.replies}</span>
              <span className="text-muted-foreground">Перевозок</span>
              <span className="text-right">{supplier.scorecard.wins}</span>
              {supplier.scorecard.breaks > 0 && (
                <>
                  <span className="text-red-600">Срывов после выбора</span>
                  <span className="text-right text-red-600 font-medium">{supplier.scorecard.breaks}</span>
                </>
              )}
              {supplier.scorecard.responseRate != null && (
                <>
                  <span className="text-muted-foreground">Отвечает</span>
                  <span className="text-right">{Math.round(supplier.scorecard.responseRate)}%</span>
                </>
              )}
              {supplier.scorecard.avgResponseMin != null && (
                <>
                  <span className="text-muted-foreground flex items-center gap-1"><Clock size={10} /> Среднее время</span>
                  <span className="text-right">
                    {supplier.scorecard.avgResponseMin < 60
                      ? `~${supplier.scorecard.avgResponseMin} мин`
                      : `~${Math.round(supplier.scorecard.avgResponseMin / 60)} ч`}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Канал связи</Label>
            <ChannelSelect value={channel} onChange={setChannel} />
          </div>

          <div className="space-y-1.5">
            <Label>Язык общения</Label>
            <LangSelect value={language} onChange={setLanguage} />
            <p className="text-xs text-muted-foreground">Запросы и уведомления уходят на этом языке.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Направления (страны)</Label>
            <Input value={directions} onChange={(e) => setDirections(e.target.value)} placeholder="Россия, Казахстан, Узбекистан" />
            <p className="text-xs text-muted-foreground">Через запятую — для автоподбора под маршрут запроса.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Виды транспорта</Label>
            <ModePicker value={modes} onChange={setModes} />
          </div>

          <div className="space-y-1.5">
            <Label>Telegram @username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@contractor" />
            <p className="text-xs text-muted-foreground">Нужно для первого контакта. Дальше система запомнит подрядчика по его ID.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@company.com" />
          </div>

          <div className="space-y-1.5">
            <Label>Телефон</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123-45-67" />
            <p className="text-xs text-muted-foreground">
              По номеру Telegram находит подрядчика и отдаёт @username — без него
              нельзя написать тому, у кого есть только числовой ID.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Аккаунт рассылки Telegram (необязательно)</Label>
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
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Сохранить
          </button>

          <div className="pt-3 mt-1 border-t">
              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Удалить «{supplier.name}» безвозвратно? Вместе с ним пропадут его ставки и
                    ответы в прошлых запросах — и его вклад в статистику цен по маршрутам.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={remove}
                      disabled={deleting}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                    >
                      {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Удалить
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} /> Удалить подрядчика
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
