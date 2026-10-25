import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Loader2,
  Plus,
  Send,
  Settings,
  Trash2,
  TriangleAlert,
  Unlink,
  X,
} from 'lucide-react';
import { getUser } from '@/lib/auth';
import { memoApi } from '@/lib/api';
import type {
  MemoCandidate,
  MemoDepartmentRow,
  MemoLinkStatus,
  MemoRoleRow,
  MemoRouteRow,
} from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MEMO_TYPE, fmtDateTime } from '@/components/memos/memo-meta';

type Tab = 'roles' | 'routes' | 'departments' | 'telegram';

const TABS: { key: Tab; label: string }[] = [
  { key: 'roles', label: 'Роли согласования' },
  { key: 'routes', label: 'Маршруты' },
  { key: 'departments', label: 'Подразделения' },
  { key: 'telegram', label: 'Привязки Telegram' },
];

/**
 * Настройка раздела записок. Только для администраторов — права проверяет
 * бэкенд, здесь просто собрано всё в одном месте.
 */
export default function MemoSettingsPage() {
  // Права проверяет и бэкенд (WorkerAdminGuard), здесь — чтобы не-админ не
  // упирался в экран, где каждое действие отвечает отказом. Кнопка в реестре
  // ему и так не видна, но прямую ссылку могли сохранить или переслать.
  const isAdmin = getUser()?.isAdmin ?? false;
  const [tab, setTab] = useState<Tab>('roles');
  const [roles, setRoles] = useState<MemoRoleRow[]>([]);
  const [routes, setRoutes] = useState<MemoRouteRow[]>([]);
  const [departments, setDepartments] = useState<MemoDepartmentRow[]>([]);
  const [links, setLinks] = useState<MemoLinkStatus[]>([]);
  const [candidates, setCandidates] = useState<MemoCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setError(null);
    try {
      const [r, rt, d, l, c] = await Promise.all([
        memoApi.admin.roles(),
        memoApi.admin.routes(),
        memoApi.admin.departments(),
        memoApi.admin.links(),
        memoApi.admin.candidates(),
      ]);
      setRoles(r);
      setRoutes(rt);
      setDepartments(d);
      setLinks(l);
      setCandidates(c);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [isAdmin]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await load();
      setLoading(false);
    };
    void run();
  }, [load]);

  const unlinked = links.filter((l) => !l.linked).length;
  const noActiveRoute = routes.filter((r) => r.isActive).length === 0;
  const emptyRoles = roles.filter(
    (r) => r.isActive && r.members.length === 0,
  ).length;

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <Link
          to="/memos"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> К реестру записок
        </Link>
        <Card>
          <CardContent className="pt-4 flex items-start gap-2 text-sm">
            <TriangleAlert
              size={15}
              className="mt-0.5 shrink-0 text-amber-600"
            />
            <div>
              <p className="font-medium">Раздел доступен администраторам</p>
              <p className="text-xs text-muted-foreground mt-1">
                Здесь настраивают роли согласования, маршруты и подразделения.
                Записки вы по-прежнему создаёте и согласуете в реестре.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/memos"
        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} /> К реестру записок
      </Link>

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings size={18} /> Настройка служебных записок
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Роли, маршруты, подразделения и привязка согласующих к боту
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Что мешает запуску — одним списком, чтобы не искать по закладкам. */}
      {!loading && (noActiveRoute || emptyRoles > 0 || unlinked > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <TriangleAlert size={13} /> Раздел ещё не готов к работе
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {emptyRoles > 0 && (
              <li>В {emptyRoles} ролях нет ни одного сотрудника.</li>
            )}
            {noActiveRoute && (
              <li>
                Не включён ни один маршрут — отправить записку не получится.
              </li>
            )}
            {unlinked > 0 && (
              <li>
                {unlinked} согласующих не привязали Telegram. Уведомления
                приходят только туда — без привязки они не узнают о задачах.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              tab === t.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted/50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <Loader2
              size={20}
              className="mx-auto mb-2 animate-spin opacity-50"
            />
            Загружаем настройки…
          </CardContent>
        </Card>
      ) : tab === 'roles' ? (
        <Roles roles={roles} candidates={candidates} onChanged={load} />
      ) : tab === 'routes' ? (
        <Routes routes={routes} roles={roles} onChanged={load} />
      ) : tab === 'departments' ? (
        <Departments
          departments={departments}
          candidates={candidates}
          onChanged={load}
        />
      ) : (
        <TelegramLinks links={links} onChanged={load} />
      )}
    </div>
  );
}

/**
 * Роли и их состав.
 *
 * Логин в кабинете согласующему не нужен, поэтому в списке кандидатов — все
 * сотрудники. И важное: исключение из роли — единственный способ отобрать
 * право согласовывать, обнуление доступа в кабинет его не касается.
 */
function Roles({
  roles,
  candidates,
  onChanged,
}: {
  roles: MemoRoleRow[];
  candidates: MemoCandidate[];
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const found = candidates
    .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 40);

  return (
    <div className="space-y-3">
      {error && <div className="text-xs text-red-600">{error}</div>}

      {roles.map((role) => (
        <Card key={role.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-sm font-medium">{role.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  код {role.code}
                </div>
              </div>
              <button
                onClick={() => {
                  setAdding(adding === role.id ? null : role.id);
                  setQuery('');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-muted/50"
              >
                <Plus size={12} /> Добавить человека
              </button>
            </div>

            {role.members.length === 0 ? (
              <p className="text-xs text-amber-700">
                Никого не назначено — записки на этом этапе согласовать будет
                некому.
              </p>
            ) : (
              <ul className="space-y-1">
                {role.members.map((m) => (
                  <li
                    key={m.employeeId}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="flex-1 min-w-0 truncate">{m.name}</span>
                    {m.telegramLinked ? (
                      <span className="text-emerald-700 inline-flex items-center gap-1 shrink-0">
                        <Send size={10} /> привязан
                      </span>
                    ) : (
                      <span className="text-amber-700 shrink-0">
                        нет Telegram
                      </span>
                    )}
                    <button
                      onClick={() =>
                        window.confirm(
                          `Убрать ${m.name} из роли «${role.name}»? Он перестанет согласовывать записки — это единственный способ отобрать право.`,
                        ) &&
                        act(() =>
                          memoApi.admin.removeMember(role.id, m.employeeId),
                        )
                      }
                      disabled={busy}
                      className="text-muted-foreground hover:text-red-600 shrink-0"
                      title="Убрать из роли"
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {adding === role.id && (
              <div className="pt-2 border-t space-y-2">
                <Input
                  className="h-8 text-sm"
                  placeholder="Поиск по фамилии"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {found.map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        act(() => memoApi.admin.addMember(role.id, c.id))
                      }
                      disabled={
                        busy || role.members.some((m) => m.employeeId === c.id)
                      }
                      className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 disabled:opacity-30 flex items-center gap-2"
                    >
                      <span className="flex-1 min-w-0 truncate">{c.name}</span>
                      {!c.login && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          без доступа в кабинет
                        </span>
                      )}
                    </button>
                  ))}
                  {found.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      Никого не нашли
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Маршруты. Правка этапов создаёт новую версию — запущенные записки идут по
 * своей, поэтому менять маршрут безопасно в любой момент.
 */
function Routes({
  routes,
  roles,
  onChanged,
}: {
  routes: MemoRouteRow[];
  roles: MemoRoleRow[];
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (route: MemoRouteRow) => {
    setEditing(route.id);
    setSteps(route.steps.map((s) => s.roleId));
  };

  const save = async (routeId: string) => {
    await act(async () => {
      await memoApi.admin.saveSteps(
        routeId,
        steps.map((roleId) => ({ roleId })),
      );
      setEditing(null);
    });
  };

  return (
    <div className="space-y-3">
      {error && <div className="text-xs text-red-600">{error}</div>}

      <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        Правка этапов создаёт <b>новую версию</b> маршрута. Записки, уже
        запущенные по прежней версии, продолжат идти по ней — менять маршрут
        можно в любой момент, не ломая работу.
      </div>

      {routes.map((route) => (
        <Card key={route.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  {route.name}
                  <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted/50">
                    {MEMO_TYPE[route.memoType].label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    версия {route.versionNo}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    act(() =>
                      memoApi.admin.setRouteActive(route.id, !route.isActive),
                    )
                  }
                  disabled={busy}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
                    route.isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'hover:bg-muted/50',
                  )}
                >
                  {route.isActive ? 'Включён' : 'Выключен'}
                </button>
                <button
                  onClick={() =>
                    editing === route.id ? setEditing(null) : startEdit(route)
                  }
                  className="px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-muted/50"
                >
                  {editing === route.id ? 'Отмена' : 'Изменить этапы'}
                </button>
              </div>
            </div>

            {editing === route.id ? (
              <div className="space-y-2 pt-1">
                {steps.map((roleId, i) => (
                  <div
                    key={`${roleId}-${i}`}
                    className="flex items-center gap-2"
                  >
                    <span className="w-5 text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    <select
                      className="h-8 flex-1 rounded-md border bg-transparent px-2 text-sm"
                      value={roleId}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((r, j) => (j === i ? e.target.value : r)),
                        )
                      }
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        setSteps((prev) => {
                          if (i === 0) return prev;
                          const next = [...prev];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        })
                      }
                      disabled={i === 0}
                      title="Выше"
                      className="p-1 rounded border disabled:opacity-30 hover:bg-muted/50"
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      onClick={() =>
                        setSteps((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="p-1 rounded border hover:bg-muted/50 text-muted-foreground hover:text-red-600"
                      title="Убрать этап"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      const free = roles.find((r) => !steps.includes(r.id));
                      if (free) setSteps((prev) => [...prev, free.id]);
                    }}
                    disabled={steps.length >= roles.length}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-muted/50 disabled:opacity-40"
                  >
                    <Plus size={12} /> Этап
                  </button>
                  <button
                    onClick={() => save(route.id)}
                    disabled={
                      busy ||
                      steps.length === 0 ||
                      new Set(steps).size !== steps.length
                    }
                    title={
                      new Set(steps).size !== steps.length
                        ? 'Одна роль не может стоять на двух этапах'
                        : undefined
                    }
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Сохранить новой версией
                  </button>
                </div>
                {new Set(steps).size !== steps.length && (
                  <p className="text-xs text-red-600">
                    Одна роль не может стоять на двух этапах: человек подписал
                    бы документ дважды.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                {route.steps.map((s, i) => (
                  <span
                    key={s.stepNo}
                    className="inline-flex items-center gap-1.5"
                  >
                    {i > 0 && <span className="text-muted-foreground">→</span>}
                    <span className="px-2 py-0.5 rounded border bg-muted/40">
                      {s.roleName}
                    </span>
                  </span>
                ))}
                {route.steps.length === 0 && (
                  <span className="text-amber-700">
                    Этапов нет — согласовывать некому
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Departments({
  departments,
  candidates,
  onChanged,
}: {
  departments: MemoDepartmentRow[];
  candidates: MemoCandidate[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Какой отдел сейчас переименовывают и каким текстом. */
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null,
  );
  /** В какой отдел добавляют человека. */
  const [adding, setAdding] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Input
            className="h-8 text-sm"
            placeholder="Название подразделения"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={() =>
              act(async () => {
                await memoApi.admin.createDepartment(name.trim());
                setName('');
              })
            }
            disabled={busy || name.trim().length < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 shrink-0"
          >
            <Plus size={12} /> Добавить
          </button>
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="space-y-3">
          {departments.map((d) => {
            const found = candidates.filter((c) =>
              c.name.toLowerCase().includes(query.trim().toLowerCase()),
            );
            return (
              <div key={d.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  {editing?.id === d.id ? (
                    <Input
                      className="h-7 text-sm flex-1"
                      autoFocus
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ id: d.id, name: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditing(null);
                        if (e.key !== 'Enter') return;
                        const next = editing.name.trim();
                        setEditing(null);
                        if (next.length >= 2 && next !== d.name) {
                          void act(() =>
                            memoApi.admin.updateDepartment(d.id, {
                              name: next,
                            }),
                          );
                        }
                      }}
                      // По потере фокуса тоже сохраняем: иначе человек,
                      // переименовавший и кликнувший мимо, решит, что сохранил.
                      onBlur={() => {
                        const next = editing.name.trim();
                        setEditing(null);
                        if (next.length >= 2 && next !== d.name) {
                          void act(() =>
                            memoApi.admin.updateDepartment(d.id, {
                              name: next,
                            }),
                          );
                        }
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setEditing({ id: d.id, name: d.name })}
                      title="Переименовать"
                      className={cn(
                        'flex-1 min-w-0 truncate text-left font-medium hover:underline',
                        !d.isActive && 'text-muted-foreground line-through',
                      )}
                    >
                      {d.name}
                    </button>
                  )}
                  {d._count && (
                    <span className="text-muted-foreground shrink-0">
                      записок {d._count.memos}
                    </span>
                  )}
                  {/* Не удаляем, а выключаем: по подразделению уже могут быть
                      записки, и в истории оно должно остаться читаемым. */}
                  <button
                    onClick={() =>
                      act(() =>
                        memoApi.admin.updateDepartment(d.id, {
                          isActive: !d.isActive,
                        }),
                      )
                    }
                    disabled={busy}
                    className="px-2 py-0.5 rounded border hover:bg-muted/50 shrink-0"
                  >
                    {d.isActive ? 'Выключить' : 'Включить'}
                  </button>
                </div>

                {d.staff.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Никого не добавлено
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {d.staff.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="flex-1 min-w-0 truncate">
                          {m.name}
                        </span>
                        <button
                          onClick={() =>
                            act(() =>
                              memoApi.admin.removeDepartmentMember(d.id, m.id),
                            )
                          }
                          disabled={busy}
                          className="text-muted-foreground hover:text-red-600 shrink-0"
                          title="Убрать из подразделения"
                        >
                          <Trash2 size={11} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {adding === d.id ? (
                  <div className="pt-2 border-t space-y-2">
                    <Input
                      className="h-8 text-sm"
                      placeholder="Поиск по фамилии"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                      {found.map((c) => (
                        <button
                          key={c.id}
                          onClick={() =>
                            act(async () => {
                              await memoApi.admin.addDepartmentMember(
                                d.id,
                                c.id,
                              );
                              setAdding(null);
                              setQuery('');
                            })
                          }
                          disabled={busy || c.memoDepartment?.id === d.id}
                          className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 disabled:opacity-30 flex items-center gap-2"
                        >
                          <span className="flex-1 min-w-0 truncate">
                            {c.name}
                          </span>
                          {/* Отдел один на человека: предупреждаем, что его
                              заберут у соседей, а не добавят вторым. */}
                          {c.memoDepartment && c.memoDepartment.id !== d.id && (
                            <span className="text-[10px] text-amber-700 shrink-0">
                              сейчас в: {c.memoDepartment.name}
                            </span>
                          )}
                        </button>
                      ))}
                      {found.length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1.5">
                          Никого не нашли
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setAdding(null);
                        setQuery('');
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAdding(d.id);
                      setQuery('');
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={11} /> Добавить человека
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Привязки Telegram.
 *
 * Код выдаётся администратором для сотрудника и показывается ровно один раз —
 * в базе лежит только хеш, потому что код равнозначен праву согласовывать.
 */
function TelegramLinks({
  links,
  onChanged,
}: {
  links: MemoLinkStatus[];
  onChanged: () => Promise<void>;
}) {
  const [issued, setIssued] = useState<{
    name: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issue = async (employeeId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await memoApi.admin.issueCode(employeeId);
      setIssued({ name: res.name, code: res.code, expiresAt: res.expiresAt });
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && <div className="text-xs text-red-600">{error}</div>}

      {issued && (
        <Card className="border-primary">
          <CardContent className="pt-4 space-y-2">
            <div className="text-xs font-medium">
              Код привязки для {issued.name}
            </div>
            <div className="flex items-center gap-2">
              <code className="text-2xl font-bold tracking-widest tabular-nums">
                {issued.code}
              </code>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(issued.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="p-1.5 rounded border hover:bg-muted/50"
                title="Скопировать"
              >
                {copied ? (
                  <Check size={13} className="text-emerald-600" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
              <button
                onClick={() => setIssued(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Передайте код сотруднику: он открывает бота записок и отправляет{' '}
              <code className="px-1 rounded bg-muted">
                /start {issued.code}
              </code>
              . Код одноразовый и действует до {fmtDateTime(issued.expiresAt)}.
              Второй раз его не посмотреть — в базе хранится только хеш.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          {links.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Пока никто не назначен в роли согласования — привязывать некого.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {links.map((l) => (
                <li
                  key={l.employeeId}
                  className="flex items-center gap-2 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{l.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {l.roles.join(', ')}
                    </div>
                  </div>
                  {l.linked ? (
                    <>
                      <span className="text-emerald-700 inline-flex items-center gap-1 shrink-0">
                        <Send size={10} /> привязан {fmtDateTime(l.linkedAt)}
                      </span>
                      <button
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Отвязать ${l.name} от бота записок?`,
                            )
                          )
                            return;
                          setBusy(true);
                          try {
                            await memoApi.admin.unlink(l.employeeId);
                            await onChanged();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        disabled={busy}
                        className="p-1 rounded border hover:bg-muted/50 text-muted-foreground shrink-0"
                        title="Отвязать"
                      >
                        <Unlink size={11} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-amber-700 shrink-0">
                        не привязан
                      </span>
                      <button
                        onClick={() => issue(l.employeeId)}
                        disabled={busy}
                        className="px-2 py-0.5 rounded border hover:bg-muted/50 shrink-0 disabled:opacity-40"
                      >
                        Выдать код
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
