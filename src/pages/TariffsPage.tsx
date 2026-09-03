import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Upload,
  RefreshCw,
  Truck,
  Train,
  Ship,
  Plane,
  Layers,
} from 'lucide-react';
import { listTariffs, type Tariff } from '../lib/api';

const TRANSPORT_ICONS: Record<string, React.ReactNode> = {
  auto: <Truck className="h-3.5 w-3.5" />,
  rail: <Train className="h-3.5 w-3.5" />,
  sea: <Ship className="h-3.5 w-3.5" />,
  air: <Plane className="h-3.5 w-3.5" />,
  multimodal: <Layers className="h-3.5 w-3.5" />,
};

const TRANSPORT_LABELS: Record<string, string> = {
  auto: 'Авто',
  rail: 'ЖД',
  sea: 'Море',
  air: 'Авиа',
  multimodal: 'Мульти',
};

function formatRate(
  label: string,
  value: string | null,
  currency: string,
): string | null {
  if (!value || Number(value) === 0) return null;
  return `${label}: ${Number(value).toFixed(2)} ${currency}`;
}

export default function TariffsPage() {
  const navigate = useNavigate();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [transportType, setTransportType] = useState('');

  const load = useCallback(
    async (pg = page) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listTariffs({
          departure: departure || undefined,
          destination: destination || undefined,
          transportType: transportType || undefined,
          page: pg,
          limit: 50,
        });
        setTariffs(res.items);
        setTotal(res.total);
        setPages(res.pages);
        setPage(pg);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [departure, destination, transportType, page],
  );

  useEffect(() => {
    load(1);
  }, [departure, destination, transportType]);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Тарифы</h1>
          <p className="text-sm text-slate-500">{total} тарифов в базе</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(1)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Обновить
          </button>
          <button
            onClick={() => navigate('/tariffs/upload')}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" /> Загрузить тариф
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            placeholder="Откуда..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Куда..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={transportType}
          onChange={(e) => setTransportType(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Все типы</option>
          {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left">Откуда</th>
              <th className="px-4 py-3 text-left">Куда</th>
              <th className="px-4 py-3 text-left">Тип</th>
              <th className="px-4 py-3 text-left">Ставки</th>
              <th className="px-4 py-3 text-left">Действует</th>
              <th className="px-4 py-3 text-left">Источник</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Загрузка...
                </td>
              </tr>
            )}
            {!loading && tariffs.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Тарифы не найдены
                </td>
              </tr>
            )}
            {tariffs.map((t) => {
              const rates = [
                formatRate('/кг', t.ratePerKg, t.currency),
                formatRate('/м³', t.ratePerCbm, t.currency),
                formatRate('/конт', t.ratePerContainer, t.currency),
              ].filter(Boolean);
              return (
                <tr
                  key={t.id}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {t.departure.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {t.destination.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      {TRANSPORT_ICONS[t.transportType]}
                      {TRANSPORT_LABELS[t.transportType] ?? t.transportType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {rates.join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {t.validFrom.slice(0, 10)} — {t.validUntil.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.sourceType === 'b24'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {t.sourceType === 'b24' ? 'Б24' : 'Инд'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm text-slate-600">
            {page} / {pages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= pages}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
