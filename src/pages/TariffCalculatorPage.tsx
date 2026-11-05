import { useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Calculator,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  estimateTariff,
  type TariffEstimate,
  type TariffEstimateParams,
} from '../lib/api';

/**
 * Калькулятор стоимости перевозки — тот же расчёт, что у клиента в lk2
 * (кнопка «Рассчитать стоимость»). Бэкенд по прайсам из «Тарифов» просит ИИ
 * найти маршрут и возвращает варианты с ценой ДЛЯ КЛИЕНТА (наценка уже внутри).
 */

type TransportType = NonNullable<TariffEstimateParams['transportType']>;

// Значения уходят на бэкенд как есть — других он не примет (400).
const TRANSPORT_OPTIONS: { value: TransportType; label: string }[] = [
  { value: 'auto', label: 'Авто' },
  { value: 'rail', label: 'ЖД' },
  { value: 'sea', label: 'Море' },
  { value: 'air', label: 'Авиа' },
];

// Тот же список, что в lk2 (lk2/src/features/create-shipment/lib/options.ts).
const CONTAINER_TYPES = [
  "20'GP",
  "40'GP",
  "40'HC",
  "20'RF (Reefer)",
  "40'RF (Reefer)",
  "45'HC",
  "20'OT (Open Top)",
  "40'OT",
];

export default function TariffCalculatorPage() {
  // ── Поля формы. Числа храним строками: так их отдаёт <input>, а пустая
  //    строка = «не заполнено». В число переводим только при отправке.
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [transportType, setTransportType] = useState<TransportType | ''>(''); // '' = любой
  const [weightKg, setWeightKg] = useState('');
  const [volumeCbm, setVolumeCbm] = useState('');
  const [containers, setContainers] = useState('');
  const [containerType, setContainerType] = useState('');

  // ── Ответ. null = ещё не считали, [] = посчитали, но вариантов нет.
  const [estimates, setEstimates] = useState<TariffEstimate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCalculate = departure.trim() !== '' && destination.trim() !== '';

  // Морю и ЖД нужны контейнеры, авто и авиа — вес и объём.
  const usesContainers = transportType === 'sea' || transportType === 'rail';

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCalculate || loading) return;
    setLoading(true);
    setError(null);
    setEstimates(null);
    try {
      const res = await estimateTariff({
        departure: departure.trim(),
        destination: destination.trim(),
        // `|| undefined`: пустое поле не отправляем вовсе. Number('') = 0,
        // а бэкенд требует положительное число — ноль он отклонит.
        transportType: transportType || undefined,
        // Скрытые поля не шлём: после переключения Море → Авто в state
        // остаются контейнеры, которых сотрудник уже не видит.
        ...(usesContainers
          ? {
              containers: Number(containers) || undefined,
              containerType: containerType || undefined,
            }
          : {
              weightKg: Number(weightKg) || undefined,
              volumeCbm: Number(volumeCbm) || undefined,
            }),
      });
      setEstimates(res.estimates);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Калькулятор стоимости
        </h1>
        <p className="text-sm text-slate-500">
          Расчёт по загруженным прайсам — та же цена, что видит клиент в личном
          кабинете.
        </p>
      </div>

      <Card>
        <CardContent className="pt-1">
          {/* form — чтобы считать и по Enter в любом поле */}
          <form onSubmit={handleCalculate} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Откуда *</Label>
                <Input
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  placeholder="Шанхай"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Куда *</Label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ташкент"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Вид транспорта</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '' as const, label: 'Любой' },
                  ...TRANSPORT_OPTIONS,
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTransportType(t.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      transportType === t.value
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {usesContainers ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Контейнеров, шт.</Label>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={containers}
                    onChange={(e) => setContainers(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Тип контейнера</Label>
                  <select
                    value={containerType}
                    onChange={(e) => setContainerType(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">—</option>
                    {CONTAINER_TYPES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Вес, кг</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="1000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Объём, м³</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={volumeCbm}
                    onChange={(e) => setVolumeCbm(e.target.value)}
                    placeholder="5"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!canCalculate || loading}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              {loading ? 'Считаем…' : 'Рассчитать'}
            </button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {estimates !== null &&
        (estimates.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            В прайсах нет такого маршрута — ставка по запросу.
          </p>
        ) : (
          <EstimateList estimates={estimates} />
        ))}
    </div>
  );
}

function EstimateList({ estimates }: { estimates: TariffEstimate[] }) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Первый вариант раскрыт сразу — чаще всего смотрят именно его.
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const sorted = [...estimates].sort((a, b) => {
    // Без цены («по запросу») — всегда в конце, в какую сторону ни сортируй.
    if (a.total === null && b.total === null) return 0;
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    return sortDir === 'asc' ? a.total - b.total : b.total - a.total;
  });

  return (
    <div className="flex flex-col gap-2">
      {sorted.length > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-slate-500">
            Найдено вариантов: {sorted.length}
          </span>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            {sortDir === 'asc' ? (
              <ArrowUpNarrowWide className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            )}
            По цене
          </button>
        </div>
      )}
      {sorted.map((est, i) => (
        <EstimateCard
          key={i}
          est={est}
          isOpen={openIdx === i}
          onToggle={() => setOpenIdx((cur) => (cur === i ? null : i))}
        />
      ))}
    </div>
  );
}

function EstimateCard({
  est,
  isOpen,
  onToggle,
}: {
  est: TariffEstimate;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const transportLabel =
    TRANSPORT_OPTIONS.find((t) => t.value === est.transportType)?.label ??
    est.transportType ??
    'Перевозка';

  const details: { label: string; value: string | null }[] = [
    { label: 'Перевалка', value: est.transitPoint },
    { label: 'Расчёт', value: est.breakdown },
    { label: 'Включено', value: est.included },
    { label: 'Не включено', value: est.excluded },
    { label: 'Срок', value: est.transitTime },
    { label: 'Условия', value: est.conditions },
  ];
  const filled = details.filter((d) => d.value);
  const hasDetails = filled.length > 0 || Boolean(est.sourceName);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasDetails}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {transportLabel}
          </p>
          <p className="truncate text-xs text-slate-500">
            {est.departure} → {est.destination}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            {est.total !== null ? (
              <p className="text-base font-bold whitespace-nowrap text-slate-900">
                {est.total.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-semibold text-slate-500">
                  {est.currency}
                </span>
              </p>
            ) : (
              <p className="text-xs text-slate-500">по запросу</p>
            )}
            {est.basis && (
              <p className="text-[11px] text-slate-500">{est.basis}</p>
            )}
            {est.freightOnly && (
              <p className="text-[11px] font-medium text-amber-600">
                только фрахт
              </p>
            )}
          </div>
          {hasDetails && (
            <ChevronDown
              className={`mt-1 h-4 w-4 text-slate-400 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </button>

      {isOpen && hasDetails && (
        <div className="space-y-1.5 border-t border-slate-100 px-4 py-2.5 text-xs">
          {filled.map((d) => (
            <p key={d.label} className="whitespace-pre-wrap text-slate-600">
              <span className="font-semibold text-slate-700">{d.label}:</span>{' '}
              {d.value}
            </p>
          ))}
          {est.sourceName && (
            <p className="text-[11px] text-slate-400 italic">
              Источник: {est.sourceName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
