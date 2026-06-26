import { useEffect, useRef, useState } from 'react';
import { Upload, Loader2, Trash2, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import {
  listTariffSources,
  uploadTariffSource,
  setTariffSourceActive,
  deleteTariffSource,
  type TariffSource,
} from '../lib/api';

const OFFICES = [
  { value: 'tashkent', label: 'Ташкент' },
  { value: 'moscow', label: 'Москва' },
];
const CATEGORIES = [
  { value: 'auto_intl', label: 'Авто (международное)' },
  { value: 'auto_local', label: 'Авто (локальное)' },
  { value: 'rail', label: 'Ж/Д' },
  { value: 'sea', label: 'Море' },
  { value: 'storage', label: 'Хранение / терминалы' },
];
const TRANSPORT_TYPES = [
  { value: 'auto', label: 'Авто' },
  { value: 'rail', label: 'ЖД' },
  { value: 'sea', label: 'Море' },
  { value: 'air', label: 'Авиа' },
];

export default function TariffSourcesPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<TariffSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [office, setOffice] = useState('tashkent');
  const [category, setCategory] = useState('auto_intl');
  const [transportTypes, setTransportTypes] = useState<string[]>(['auto']);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setSources(await listTariffSources());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  function toggleType(t: string) {
    setTransportTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleUpload() {
    if (!file || !name.trim() || transportTypes.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await uploadTariffSource(file, {
        name: name.trim(),
        office,
        category,
        transportTypes,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
      });
      setFile(null);
      setName('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(s: TariffSource) {
    await setTariffSourceActive(s.id, !s.isActive);
    load();
  }
  async function remove(s: TariffSource) {
    if (!confirm(`Удалить источник «${s.name}»?`)) return;
    await deleteTariffSource(s.id);
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Источники тарифов</h1>
        <p className="text-sm text-slate-500">
          Прайсы хранятся «как есть»; по ним ИИ считает стоимость в калькуляторе клиента.
        </p>
      </div>

      {/* Upload form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Название прайса</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="напр. Международное авто (Ташкент)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Офис</label>
            <select value={office} onChange={(e) => setOffice(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {OFFICES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Категория</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Типы транспорта</label>
            <div className="flex flex-wrap gap-2">
              {TRANSPORT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleType(t.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    transportTypes.includes(t.value)
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Действует с</label>
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Действует до</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Файл прайса (CSV / XLSX)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
            />
          </div>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleUpload}
          disabled={uploading || !file || !name.trim() || transportTypes.length === 0}
          className="mt-4 flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Загрузить прайс
        </button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left">Прайс</th>
              <th className="px-4 py-3 text-left">Офис</th>
              <th className="px-4 py-3 text-left">Категория</th>
              <th className="px-4 py-3 text-left">Типы</th>
              <th className="px-4 py-3 text-left">Действует</th>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Загрузка...</td></tr>}
            {!loading && sources.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Пока нет источников</td></tr>}
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <FileSpreadsheet className="h-4 w-4 text-slate-400" />{s.name}
                  </div>
                  <div className="text-xs text-slate-400">{s.fileName}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{OFFICES.find((o) => o.value === s.office)?.label ?? s.office}</td>
                <td className="px-4 py-3 text-slate-600">{CATEGORIES.find((c) => c.value === s.category)?.label ?? s.category}</td>
                <td className="px-4 py-3 text-slate-600">{s.transportTypes.join(', ')}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{(s.validFrom?.slice(0, 10) ?? '—')} — {(s.validUntil?.slice(0, 10) ?? '—')}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {s.isActive ? 'Активен' : 'Выключен'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => toggleActive(s)} title={s.isActive ? 'Выключить' : 'Включить'} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      {s.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button onClick={() => remove(s)} title="Удалить" className="rounded p-1.5 text-red-400 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
