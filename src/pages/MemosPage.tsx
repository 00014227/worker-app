import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Inbox,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  TriangleAlert,
} from 'lucide-react';
import { memoApi } from '@/lib/api';
import type { MemoListResponse, MemoMeta, MemoStatus, MemoTaskRow, MemoType } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import MemoForm from '@/components/memos/MemoForm';
import {
  MEMO_STATUS,
  MEMO_TYPE,
  dueLabel,
  fmtDate,
  fmtMoney,
  overdueClass,
} from '@/components/memos/memo-meta';

const selectCls =
  'h-8 rounded-md border bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

/** Плитки-фильтры: как в дебиторке, но по статусам записок. */
const BUCKETS: { key: MemoStatus | 'all'; label: string; hint: string }[] = [
  { key: 'all', label: 'Все', hint: 'доступные мне' },
  { key: 'pending_approval', label: 'На согласовании', hint: 'идут по маршруту' },
  { key: 'changes_requested', label: 'На доработке', hint: 'вернули автору' },
  { key: 'approved', label: 'Утверждены', hint: 'решение принято' },
  { key: 'rejected', label: 'Отклонены', hint: 'маршрут остановлен' },
  { key: 'draft', label: 'Черновики', hint: 'ещё не отправлены' },
];

export default function MemosPage() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<MemoMeta | null>(null);
  const [data, setData] = useState<MemoListResponse | null>(null);
  const [tasks, setTasks] = useState<MemoTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MemoStatus | 'all'>('all');
  const [memoType, setMemoType] = useState<MemoType | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Счётчики по статусам — отдельным запросом аналитики: считать их по текущей
  // странице нельзя, постраничность серверная.
  const [counts, setCounts] = useState<Partial<Record<MemoStatus, number>>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, analytics] = await Promise.all([
        memoApi.list({
          search: search.trim() || undefined,
          status: status === 'all' ? undefined : status,
          memoType: memoType || undefined,
          departmentId: departmentId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          limit: 25,
        }),
        memoApi.analytics(dateFrom || undefined, dateTo || undefined),
      ]);
      setData(list);
      setCounts(analytics.byStatus);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [search, status, memoType, departmentId, dateFrom, dateTo, page]);

  useEffect(() => {
    // Эффект при открытии не должен синхронно дёргать setState.
    const run = async () => {
      setLoading(true);
      try {
        const [m, t] = await Promise.all([memoApi.meta(), memoApi.myTasks()]);
        setMeta(m);
        setTasks(t);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + (b ?? 0), 0),
    [counts],
  );

  const refresh = async () => {
    setLoading(true);
    await Promise.all([load(), memoApi.myTasks().then(setTasks).catch(() => undefined)]);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList size={18} /> Служебные записки
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Оплаты, закупки и командировки — от создания до решения директора
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            title="Обновить"
            className="p-2 rounded-lg border hover:bg-muted/50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {meta?.can.manage && (
            <Link
              to="/memos/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <Settings size={13} /> Настройки
            </Link>
          )}
          <button
            onClick={() => setCreating(true)}
            disabled={!meta}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Plus size={13} /> Создать записку
          </button>
        </div>
      </div>

      {/* Уведомления идут только в Telegram — без привязки человек ничего не
          получит, и об этом надо сказать прямо, а не прятать в настройках. */}
      {meta && meta.can.decide && !meta.telegramLinked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 flex items-start gap-2">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          <span>
            Вы согласующий, но <b>не привязали Telegram</b> — уведомления и напоминания о новых
            задачах приходят только туда. Попросите администратора выдать код привязки, иначе
            задачи придётся искать здесь вручную.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Переключатель: весь реестр или только то, что ждёт меня. */}
      <div className="flex items-center gap-2">
        {(
          [
            { key: 'all' as const, label: 'Реестр', count: total },
            { key: 'mine' as const, label: 'Ждут моего решения', count: tasks.length },
          ] satisfies { key: 'all' | 'mine'; label: string; count: number }[]
        ).map((t) => (
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
            {t.count > 0 && (
              <span
                className={cn(
                  'ml-1.5 px-1.5 rounded text-[10px]',
                  tab === t.key ? 'bg-primary-foreground/20' : 'bg-muted',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'mine' ? (
        <MyTasks tasks={tasks} onOpen={(id) => navigate(`/memos/${id}`)} />
      ) : (
        <>
          {/* Плитки по статусам. Клик — фильтр, как в дебиторке. */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {BUCKETS.map((b) => {
              const count = b.key === 'all' ? total : (counts[b.key] ?? 0);
              return (
                <button
                  key={b.key}
                  onClick={() => {
                    setStatus(b.key);
                    setPage(1);
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left transition-all hover:bg-muted/30',
                    status === b.key && 'border-primary ring-1 ring-primary',
                  )}
                >
                  <div className="text-[11px] font-medium truncate">{b.label}</div>
                  <div className="text-lg font-bold leading-tight">{count}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{b.hint}</div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Номер или заголовок"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className={selectCls}
              value={memoType}
              onChange={(e) => {
                setMemoType(e.target.value as MemoType | '');
                setPage(1);
              }}
            >
              <option value="">Все типы</option>
              {meta?.types.map((t) => (
                <option key={t.type} value={t.type}>
                  {MEMO_TYPE[t.type].label}
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все подразделения</option>
              {meta?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className={selectCls}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
            <input
              type="date"
              className={selectCls}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Card>
            {!data ? (
              <CardContent className="py-14 text-center text-sm text-muted-foreground">
                <Loader2 size={20} className="mx-auto mb-2 animate-spin opacity-50" />
                Загружаем реестр…
              </CardContent>
            ) : data.data.length === 0 ? (
              <CardContent className="py-14 text-center text-sm text-muted-foreground">
                <Inbox size={26} className="mx-auto mb-2 opacity-30" />
                {data.meta.total === 0 && !search && status === 'all'
                  ? 'Записок пока нет. Создайте первую — она появится здесь.'
                  : 'Под фильтр ничего не попало'}
              </CardContent>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Номер</th>
                        <th className="px-4 py-2 text-left font-medium">Тип</th>
                        <th className="px-4 py-2 text-left font-medium">Заголовок</th>
                        <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                          Автор
                        </th>
                        <th className="px-4 py-2 text-left font-medium hidden lg:table-cell">
                          Подразделение
                        </th>
                        <th className="px-4 py-2 text-right font-medium">Сумма</th>
                        <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                          Сейчас у кого
                        </th>
                        <th className="px-4 py-2 text-left font-medium">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.data.map((m) => (
                        <tr
                          key={m.id}
                          onClick={() => navigate(`/memos/${m.id}`)}
                          className="hover:bg-muted/20 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="font-medium">{m.number ?? '—'}</div>
                            <div className="text-xs text-muted-foreground">
                              {fmtDate(m.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                            {MEMO_TYPE[m.memoType].short}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="max-w-[320px] truncate">{m.title}</div>
                          </td>
                          <td className="px-4 py-2.5 text-xs hidden md:table-cell">
                            {m.authorName}
                          </td>
                          <td className="px-4 py-2.5 text-xs hidden lg:table-cell">
                            {m.departmentName ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {fmtMoney(m.amount, m.currency)}
                          </td>
                          <td className="px-4 py-2.5 text-xs hidden md:table-cell">
                            {m.currentRoleName ? (
                              <>
                                <div>{m.currentRoleName}</div>
                                {m.dueAt && (
                                  <div className={cn('text-[11px]', overdueClass(m.dueAt))}>
                                    {dueLabel(m.dueAt)}
                                  </div>
                                )}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap',
                                MEMO_STATUS[m.status].chip,
                              )}
                            >
                              {MEMO_STATUS[m.status].label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data.meta.pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs">
                    <span className="text-muted-foreground">
                      {data.meta.total} записок, страница {data.meta.page} из {data.meta.pages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={data.meta.page <= 1}
                        className="p-1.5 rounded border disabled:opacity-30 hover:bg-muted/50"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={data.meta.page >= data.meta.pages}
                        className="p-1.5 rounded border disabled:opacity-30 hover:bg-muted/50"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}

      {creating && meta && (
        <MemoForm
          meta={meta}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            navigate(`/memos/${id}`);
          }}
        />
      )}
    </div>
  );
}

/**
 * Личный список задач.
 *
 * Нужен не для удобства: уведомления идут только в Telegram, и для
 * непривязанного согласующего это единственное место, где он вообще узнает о
 * задаче.
 */
function MyTasks({ tasks, onOpen }: { tasks: MemoTaskRow[]; onOpen: (id: string) => void }) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-sm text-muted-foreground">
          <Inbox size={26} className="mx-auto mb-2 opacity-30" />
          Записок, ждущих вашего решения, нет
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <button
          key={t.taskId}
          onClick={() => onOpen(t.memoId)}
          className="w-full text-left rounded-xl border px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{t.number ?? 'без номера'}</span>
            <span className="text-xs px-1.5 py-0.5 rounded border bg-muted/50">
              {MEMO_TYPE[t.memoType].label}
            </span>
            <span className="text-xs text-muted-foreground">этап {t.stepNo} · {t.roleName}</span>
            {t.dueAt && (
              <span className={cn('ml-auto text-xs flex items-center gap-1', overdueClass(t.dueAt))}>
                <Clock size={11} /> {dueLabel(t.dueAt)}
              </span>
            )}
          </div>
          <div className="text-sm mt-1">{t.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t.authorName}
            {t.amount && ` · ${fmtMoney(t.amount, t.currency)}`}
          </div>
        </button>
      ))}
    </div>
  );
}
