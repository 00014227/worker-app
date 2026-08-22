import { useEffect, useMemo, useState } from 'react';
import {
  UserCog, Search, RefreshCw, Loader2, Plus, KeyRound, ShieldCheck, Copy, Check, X, Mail, Phone,
  Pencil, Save,
} from 'lucide-react';
import { employeeApi, EmployeeAdminRow, CreateEmployeeInput, DepartmentRow } from '../lib/api';
import { getUser } from '../lib/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Пароль показывается ОДИН раз — на сервере хранится только его хеш, и «посмотреть
 * потом» уже нельзя. Поэтому генератор и кнопка копирования рядом с полем.
 */
function generatePassword(length = 12): string {
  // Без похожих символов (0/O, 1/l/I) — пароль часто передают голосом или в чате.
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Логин по умолчанию из имени: «Наталья Мышакина» → «myshakina». */
function suggestLogin(name: string): string {
  const translit: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya',
  };
  const surname = name.trim().split(/\s+/)[1] ?? name.trim().split(/\s+/)[0] ?? '';
  return surname
    .toLowerCase()
    .split('')
    .map((ch) => translit[ch] ?? (/[a-z0-9]/.test(ch) ? ch : ''))
    .join('');
}

const selectCls =
  'w-full h-9 rounded-md border border-border bg-background px-2 text-sm outline-none';

/** Выбор офиса. Пустое значение допустимо — тогда действуют настройки по умолчанию. */
function DepartmentSelect({
  value, options, onChange,
}: {
  value: string;
  options: DepartmentRow[];
  onChange: (id: string) => void;
}) {
  return (
    <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— не указано —</option>
      {options.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

export default function EmployeesPage() {
  const me = getUser();
  const [rows, setRows] = useState<EmployeeAdminRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmployeeAdminRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  const load = () => {
    setLoading(true);
    employeeApi
      .list()
      .then(setRows)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    employeeApi.departments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.login ?? '').toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const withAccess = rows.filter((e) => e.hasAccess).length;

  const upsertRow = (row: EmployeeAdminRow) =>
    setRows((prev) => {
      const i = prev.findIndex((e) => e.id === row.id);
      if (i === -1) return [row, ...prev];
      const next = [...prev];
      next[i] = row;
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Сотрудники</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? 'Загрузка…' : `${rows.length} человек · с доступом ${withAccess}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} /> Добавить сотрудника
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8 h-8 text-sm"
          placeholder="Поиск по имени, логину или почте…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="px-0 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Сотрудник</th>
                  <th className="px-4 py-2 text-left font-medium hidden md:table-cell">Подразделение</th>
                  <th className="px-4 py-2 text-left font-medium">Логин</th>
                  <th className="px-4 py-2 text-center font-medium">Доступ</th>
                  <th className="px-4 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="font-medium flex items-center gap-1.5">
                        {e.name}
                        {e.isAdmin && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary inline-flex items-center gap-1">
                            <ShieldCheck size={9} /> админ
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {e.email && <span className="inline-flex items-center gap-1"><Mail size={10} /> {e.email}</span>}
                        {e.phone && <span className="inline-flex items-center gap-1"><Phone size={10} /> {e.phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                      {e.department ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.login ?? '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {e.hasAccess ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                          есть
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border">
                          нет
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setSelected(e)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                      >
                        <Pencil size={12} /> Изменить
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      <UserCog size={26} className="mx-auto mb-2 opacity-30" /> Сотрудники не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <EmployeePanel
          employee={selected}
          departments={departments}
          isSelf={me?.id === selected.id}
          onClose={() => setSelected(null)}
          onSaved={(row) => {
            upsertRow(row);
            setSelected(null);
          }}
        />
      )}

      {creating && (
        <CreateEmployeePanel
          departments={departments}
          onClose={() => setCreating(false)}
          onCreated={(row) => {
            upsertRow(row);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Карточка сотрудника: данные и доступ. Разделены намеренно — правка контактов
 * не должна требовать смены пароля, а смена пароля не должна трогать остальное.
 */
function EmployeePanel({
  employee, departments, isSelf, onClose, onSaved,
}: {
  employee: EmployeeAdminRow;
  departments: DepartmentRow[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: (row: EmployeeAdminRow) => void;
}) {
  // ── Данные сотрудника ──
  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email ?? '');
  const [phone, setPhone] = useState(employee.phone ?? '');
  const [departmentId, setDepartmentId] = useState(employee.departmentId ?? '');
  const [bitrixId, setBitrixId] = useState(employee.bitrix24Id ? String(employee.bitrix24Id) : '');
  const [isAdmin, setIsAdmin] = useState(employee.isAdmin);
  const [isLawyer, setIsLawyer] = useState(employee.isLawyer ?? false);
  const [reportsEnabled, setReportsEnabled] = useState(employee.reportsEnabled);

  // ── Доступ ──
  const [login, setLogin] = useState(employee.login ?? suggestLogin(employee.name));
  const [password, setPassword] = useState(() => generatePassword());

  const [savingCard, setSavingCard] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const cardChanged =
    name !== employee.name ||
    email !== (employee.email ?? '') ||
    phone !== (employee.phone ?? '') ||
    departmentId !== (employee.departmentId ?? '') ||
    bitrixId !== (employee.bitrix24Id ? String(employee.bitrix24Id) : '') ||
    isAdmin !== employee.isAdmin ||
    isLawyer !== (employee.isLawyer ?? false) ||
    reportsEnabled !== employee.reportsEnabled;

  const copy = async () => {
    await navigator.clipboard.writeText(`Логин: ${login}\nПароль: ${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveCard = async () => {
    setSavingCard(true);
    setError(null);
    try {
      const row = await employeeApi.update(employee.id, {
        name: name.trim(),
        email,
        phone,
        departmentId,
        reportsEnabled,
        // Свои админские права не трогаем — бэкенд их всё равно отклонит.
        ...(isSelf ? {} : { isAdmin }),
        isLawyer,
        ...(bitrixId ? { bitrix24Id: Number(bitrixId) } : {}),
      });
      onSaved(row);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingCard(false);
    }
  };

  const saveAccess = async () => {
    setSavingAccess(true);
    setError(null);
    try {
      onSaved(await employeeApi.issueCredentials(employee.id, { login: login.trim(), password }));
    } catch (e) {
      setError((e as Error).message);
      setSavingAccess(false);
    }
  };

  const revoke = async () => {
    setSavingAccess(true);
    setError(null);
    try {
      onSaved(await employeeApi.revokeAccess(employee.id));
    } catch (e) {
      setError((e as Error).message);
      setSavingAccess(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-background shadow-xl p-5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-sm">{employee.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {employee.hasAccess ? `Доступ выдан · логин ${employee.login}` : 'Доступа пока нет'}
        </p>

        {error && <div className="mb-3 text-xs text-red-600">{error}</div>}

        {/* ── Данные сотрудника ── */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Данные
          </div>

          <div className="space-y-1.5">
            <Label>ФИО</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Телефон</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Подразделение (офис)</Label>
            <DepartmentSelect value={departmentId} options={departments} onChange={setDepartmentId} />
            <p className="text-xs text-muted-foreground">
              Определяет воронку Битрикса и импорт/экспорт для сотрудника.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Bitrix24 ID</Label>
            <Input
              value={bitrixId}
              onChange={(e) => setBitrixId(e.target.value.replace(/\D/g, ''))}
              placeholder="напр. 2999"
            />
            <p className="text-xs text-muted-foreground">
              Нужен, чтобы сделки создавались от имени сотрудника.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isAdmin}
              disabled={isSelf}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Права администратора</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isLawyer}
              onChange={(e) => setIsLawyer(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Юрист — доступ к проверке контрагентов</span>
          </label>
          {isSelf && (
            <p className="text-xs text-muted-foreground -mt-1">
              Свои права администратора изменить нельзя.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={reportsEnabled}
              onChange={(e) => setReportsEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Слать отчёты по активным перевозкам</span>
          </label>
          <p className="text-xs text-muted-foreground -mt-1">
            Ежедневный Excel на почту (если пусто — на логин) по перевозкам, где сотрудник КАМ.
          </p>

          <button
            onClick={saveCard}
            disabled={savingCard || !cardChanged || name.trim().length < 2}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 disabled:opacity-40 transition-colors"
          >
            {savingCard ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saved ? (
              <Check size={15} className="text-green-600" />
            ) : (
              <Save size={15} />
            )}
            {saved ? 'Сохранено' : 'Сохранить изменения'}
          </button>
        </div>

        {/* ── Доступ ── */}
        <div className="space-y-3 mt-6 pt-5 border-t">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Доступ в систему
          </div>

          <div className="space-y-1.5">
            <Label>Логин</Label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ivanov" />
          </div>

          <div className="space-y-1.5">
            <Label>{employee.hasAccess ? 'Новый пароль' : 'Пароль'}</Label>
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                title="Сгенерировать новый"
                className="px-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                onClick={copy}
                title="Скопировать логин и пароль"
                className="px-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
              >
                {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
              </button>
            </div>
            {/* Хеш необратим: после сохранения пароль восстановить нельзя, только сбросить. */}
            <p className="text-xs text-amber-700">
              Скопируйте пароль сейчас — посмотреть его позже будет нельзя, только задать новый.
            </p>
          </div>

          <button
            onClick={saveAccess}
            disabled={savingAccess || !login.trim() || password.length < 8}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {savingAccess ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            {employee.hasAccess ? 'Сохранить новый пароль' : 'Выдать доступ'}
          </button>

          {employee.hasAccess && !isSelf && (
            <button
              onClick={revoke}
              disabled={savingAccess}
              className="w-full px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-40 transition-colors"
            >
              Отозвать доступ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


/** Новый сотрудник — для тех, кого нет в выгрузке из 1С. */
function CreateEmployeePanel({
  departments, onClose, onCreated,
}: {
  departments: DepartmentRow[];
  onClose: () => void;
  onCreated: (row: EmployeeAdminRow) => void;
}) {
  const [form, setForm] = useState<CreateEmployeeInput>({ name: '' });
  const [withAccess, setWithAccess] = useState(true);
  const [password, setPassword] = useState(() => generatePassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<CreateEmployeeInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onCreated(
        await employeeApi.create({
          name: form.name.trim(),
          email: form.email?.trim() || undefined,
          phone: form.phone?.trim() || undefined,
          isAdmin: form.isAdmin ?? false,
          isLawyer: form.isLawyer ?? false,
          bitrix24Id: form.bitrix24Id,
          departmentId: form.departmentId || undefined,
          ...(withAccess
            ? { login: (form.login || suggestLogin(form.name)).trim(), password }
            : {}),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-background shadow-xl p-5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Новый сотрудник</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>ФИО *</Label>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Иванов Иван"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Телефон</Label>
              <Input value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Подразделение (офис)</Label>
            <DepartmentSelect
              value={form.departmentId ?? ''}
              options={departments}
              onChange={(id) => set({ departmentId: id })}
            />
            <p className="text-xs text-muted-foreground">
              От офиса зависят воронка Битрикса и определение импорт/экспорт.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Bitrix24 ID</Label>
            <Input
              value={form.bitrix24Id ? String(form.bitrix24Id) : ''}
              onChange={(e) =>
                set({ bitrix24Id: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined })
              }
              placeholder="напр. 2999"
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={withAccess}
              onChange={(e) => setWithAccess(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Сразу выдать доступ в систему</span>
          </label>

          {withAccess && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label>Логин</Label>
                <Input
                  value={form.login ?? ''}
                  onChange={(e) => set({ login: e.target.value })}
                  placeholder={form.name ? suggestLogin(form.name) : 'ivanov'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Пароль</Label>
                <div className="flex gap-2">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    className="px-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
                <p className="text-xs text-amber-700">
                  Запишите пароль — позже его можно только сбросить.
                </p>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAdmin ?? false}
              onChange={(e) => set({ isAdmin: e.target.checked })}
              className="w-4 h-4"
            />
            <span>Права администратора</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isLawyer ?? false}
              onChange={(e) => set({ isLawyer: e.target.checked })}
              className="w-4 h-4"
            />
            <span>Юрист — доступ к проверке контрагентов</span>
          </label>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <button
            onClick={save}
            disabled={saving || form.name.trim().length < 2 || (withAccess && password.length < 8)}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40',
            )}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Создать сотрудника
          </button>
        </div>
      </div>
    </div>
  );
}
