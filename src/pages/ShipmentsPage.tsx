import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Package,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Truck,
  Plane,
  Train,
  Layers,
  RefreshCw,
  Filter,
  Plus,
} from 'lucide-react';
import { workerApi, OrderRow, OrderQuery } from '../lib/api';
import { getUser } from '../lib/auth';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// label → actual DB name
const TRANSPORT_FILTERS: { label: string; value: string }[] = [
  { label: 'Авто', value: 'Авто' },
  { label: 'Авиа', value: 'Авиа' },
  { label: 'Ж/Д', value: 'Железнодорожная' },
  { label: 'Мульти', value: 'Мультимодальная' },
  { label: 'Кодовая', value: 'Кодовая' },
];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  Авто: <Truck size={12} />,
  Авиа: <Plane size={12} />,
  Железнодорожная: <Train size={12} />,
  Мультимодальная: <Layers size={12} />,
};

const TYPE_COLORS: Record<string, string> = {
  Авто: 'bg-orange-100 text-orange-700 border-orange-200',
  Авиа: 'bg-sky-100 text-sky-700 border-sky-200',
  Железнодорожная: 'bg-violet-100 text-violet-700 border-violet-200',
  Мультимодальная: 'bg-teal-100 text-teal-700 border-teal-200',
};

function statusColor(s: string | null) {
  if (!s) return 'bg-slate-100 text-slate-600 border-slate-200';
  const l = s.toLowerCase();
  if (l.includes('завершен') || l.includes('доставлен'))
    return 'bg-green-50 text-green-700 border-green-200';
  if (l.includes('отмен')) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const user = getUser();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const LIMIT = 25;

  const fetch = useCallback(async (q: OrderQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await workerApi.orders.list(q);
      setOrders(res.data);
      setTotal(res.meta.total);
      setPages(res.meta.pages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch({ search, transportType: typeFilter, page, limit: LIMIT });
  }, [search, typeFilter, page, fetch]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Перевозки</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading
              ? 'Загрузка...'
              : `${total.toLocaleString('ru-RU')} записей`}
            {!user?.isAdmin && ' · только ваши'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              fetch({ search, transportType: typeFilter, page, limit: LIMIT })
            }
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => navigate('/shipments/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} /> Новая
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Номер, клиент, маршрут, авто..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* Transport type */}
        <div className="flex items-center gap-1">
          <Filter size={13} className="text-muted-foreground" />
          {TRANSPORT_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => {
                setTypeFilter(typeFilter === value ? '' : value);
                setPage(1);
              }}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                typeFilter === value
                  ? (TYPE_COLORS[value] ??
                      'bg-foreground text-background border-foreground')
                  : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
            >
              {TYPE_ICONS[value]}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <Card>
        {loading && orders.length === 0 ? (
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Package
              size={28}
              className="mx-auto mb-2 opacity-30 animate-pulse"
            />
            Загрузка...
          </CardContent>
        ) : orders.length === 0 ? (
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Package size={28} className="mx-auto mb-2 opacity-30" />
            Перевозки не найдены
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Номер
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Клиент
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">
                    Маршрут
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">
                    Тип
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">
                    Отправление
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">
                    Ответственный
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => navigate(`/shipments/${o.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-xs">
                        {o.number}
                      </span>
                      {o.postingDate && (
                        <p className="text-xs text-muted-foreground">
                          {o.postingDate}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate font-medium text-xs">
                        {o.payer?.name ?? o.customer?.name ?? '—'}
                      </p>
                      {o.vehicleNumbers && (
                        <p className="text-xs text-muted-foreground truncate">
                          {o.vehicleNumbers}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {o.departure || o.destination ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="truncate max-w-[90px]">
                            {o.departure ?? '—'}
                          </span>
                          <ArrowRight
                            size={10}
                            className="text-muted-foreground shrink-0"
                          />
                          <span className="truncate max-w-[90px]">
                            {o.destination ?? '—'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {o.transportationType ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                            TYPE_COLORS[o.transportationType] ??
                              'bg-slate-100 text-slate-600 border-slate-200',
                          )}
                        >
                          {TYPE_ICONS[o.transportationType]}
                          {o.transportationType}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {o.departureDateActual ?? o.departureDatePlan ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-xs">
                      {o.responsible?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-xs font-medium border',
                          statusColor(o.status),
                        )}
                      >
                        {o.status ?? 'Открытые'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Страница {page} из {pages} · {total.toLocaleString('ru-RU')} записей
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const n = Math.max(1, Math.min(pages - 4, page - 2)) + i;
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={cn(
                    'w-7 h-7 rounded text-xs font-medium transition-colors',
                    n === page
                      ? 'bg-foreground text-background'
                      : 'hover:bg-muted',
                  )}
                >
                  {n}
                </button>
              );
            })}
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
