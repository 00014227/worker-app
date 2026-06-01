import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, TrendingUp, Calendar, Truck, ArrowRight, RefreshCw } from 'lucide-react';
import { workerApi, OrderStats, OrderRow } from '../lib/api';
import { getUser } from '../lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function statusColor(s: string | null) {
  if (!s) return 'bg-slate-100 text-slate-600';
  const l = s.toLowerCase();
  if (l.includes('завершен') || l.includes('доставлен')) return 'bg-green-100 text-green-700';
  if (l.includes('отмен')) return 'bg-red-100 text-red-700';
  return 'bg-blue-100 text-blue-700';
}

const TYPE_COLORS: Record<string, string> = {
  'Авто':           'bg-orange-100 text-orange-700',
  'Авиа':           'bg-sky-100 text-sky-700',
  'ЖД':             'bg-violet-100 text-violet-700',
  'Мультимодальная':'bg-teal-100 text-teal-700',
  'Кодовая':        'bg-pink-100 text-pink-700',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [recent, setRecent] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([
        workerApi.orders.stats(),
        workerApi.orders.list({ limit: 8, activeOnly: 'true' }),
      ]);
      setStats(s);
      setRecent(r.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}{user ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Package size={18} />}
          label="Всего перевозок"
          value={stats?.total ?? '—'}
          color="blue"
          loading={loading}
        />
        <StatCard
          icon={<Calendar size={18} />}
          label="За этот месяц"
          value={stats?.thisMonth ?? '—'}
          color="violet"
          loading={loading}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="За эту неделю"
          value={stats?.thisWeek ?? '—'}
          color="green"
          loading={loading}
        />
        <StatCard
          icon={<Truck size={18} />}
          label="Типов перевозок"
          value={stats ? stats.byType.length : '—'}
          color="orange"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* By transport type */}
        {stats && stats.byType.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">По типу перевозки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.byType.map((t) => (
                <div key={t.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[t.name] ?? 'bg-slate-100 text-slate-600')}>
                      {t.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden w-20">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.round((t.count / (stats.total || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold tabular-nums w-8 text-right">{t.count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent orders */}
        <Card className={cn(stats && stats.byType.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3')}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Активные перевозки</CardTitle>
            <button
              onClick={() => navigate('/shipments')}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Все <ArrowRight size={12} />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">Загрузка...</div>
            ) : recent.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">Нет данных</div>
            ) : (
              <div className="divide-y">
                {recent.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/shipments/${o.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{o.number}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', statusColor(o.status))}>
                          {o.status ?? 'Открытые'}
                        </span>
                        {o.transportationType && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', TYPE_COLORS[o.transportationType] ?? 'bg-slate-100 text-slate-600')}>
                            {o.transportationType}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {o.payer?.name ?? o.customer?.name ?? '—'}
                        {o.departure && o.destination ? ` · ${o.departure} → ${o.destination}` : ''}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {o.postingDate ?? ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, loading }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'violet' | 'orange';
  loading: boolean;
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">
              {loading ? <span className="text-muted-foreground animate-pulse">...</span> : value}
            </p>
          </div>
          <div className={cn('p-2 rounded-lg', colors[color])}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
