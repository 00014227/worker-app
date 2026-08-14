import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, ExternalLink, Sparkles, X, Search } from 'lucide-react';
import { authHeaders } from '../lib/auth';
import { confirmOnStand } from '../lib/env';

// Empty default → relative `/api` requests go through the Vite dev proxy
// (and same-origin in production), avoiding the cross-origin CORS failure.
const API_URL = import.meta.env.VITE_API_URL ?? '';

interface CompanyOption { id: number; title: string; }

interface DealFields {
  title: string | null;
  company: string | null;
  companyId: number | null;
  contact: string | null;
  isUrgent: boolean;
  transportationType: string | null;
  requestType: 'Индикативный' | 'Реальный' | null;
  managerRate: string | null;
  netCostFromContractor: string | null;
  netCostBreakdown: string | null;
  incoterms: string | null;
  mode: string | null;
  direction: string | null;
  departureCountry: string | null;
  departureAddress: string | null;
  destinationCountry: string | null;
  destinationAddress: string | null;
  cargoDescription: string | null;
  numberOfPlaces: string | null;
  weight: string | null;
  dimensions: string | null;
  volume: string | null;
  temperatureRegime: string | null;
  packingInfo: string | null;
  hsCode: string | null;
  customsPlace: string | null;
  invoiceValue: string | null;
  invoiceCurrency: string | null;
  cargoReadiness: string | null;
  transportationUnit: string | null;
  transportationUnitCount: string | null;
  validityOfRates: string | null;
  transitTime: string | null;
  features: string | null;
}

type Step = 'input' | 'parsing' | 'review' | 'creating' | 'done';

// ── Field groups matching Bitrix24 sections ──────────────────────────────────
const TRANSPORTATION_TYPE_OPTIONS = [
  'Авиа',
  'FTL',
  'LTL',
  'Ж/Д',
  'Мультимодальная',
  'LCL',
  'Складская логистика',
  'Таможенное оформление',
  'Кодовая',
  'Курьерские услуги',
];

const FIELD_GROUPS: Array<{
  title: string;
  fields: Array<{ key: keyof DealFields; label: string; type?: 'textarea' | 'checkbox' | 'select' }>;
}> = [
  {
    title: 'О сделке',
    fields: [
      { key: 'title', label: 'Название' },
      { key: 'company', label: 'Компания' },
      { key: 'contact', label: 'Контакт' },
      { key: 'isUrgent', label: 'Срочно?', type: 'checkbox' },
      { key: 'transportationType', label: 'Тип перевозки', type: 'select' },
      { key: 'requestType', label: 'Тип запроса' },
      { key: 'managerRate', label: 'Ставка менеджера' },
      { key: 'netCostFromContractor', label: 'Стоимость нетто от подрядчика' },
      { key: 'netCostBreakdown', label: 'Расшифровка нетто ставки', type: 'textarea' },
    ],
  },
  {
    title: 'Маршрут',
    fields: [
      { key: 'incoterms', label: 'Incoterms / Условия перевозки' },
      { key: 'direction', label: 'Mode / Режим (Импорт/Экспорт)' },
      { key: 'mode', label: 'Тип загрузки (FCL/FTL/LCL)' },
      { key: 'departureCountry', label: 'Departure country / Страна отправления' },
      { key: 'departureAddress', label: 'Departure address / Адрес отправления' },
      { key: 'destinationCountry', label: 'Destination country / Страна назначения' },
      { key: 'destinationAddress', label: 'Destination address / Адрес назначения' },
    ],
  },
  {
    title: 'Груз',
    fields: [
      { key: 'cargoDescription', label: 'Cargo description / Наименование груза' },
      { key: 'numberOfPlaces', label: 'Number of places / Количество мест, шт' },
      { key: 'weight', label: 'Net/Gross Weight, kg / Вес нетто/брутто, кг' },
      { key: 'dimensions', label: 'Dimensions (LxWxH), cm / Габариты (ДхШхВ), см' },
      { key: 'volume', label: 'Volume, m³ / Объём, м³' },
      { key: 'temperatureRegime', label: 'Temperature regime / Температурный режим, °C' },
      { key: 'packingInfo', label: 'Packing information / Информация об упаковке' },
      { key: 'hsCode', label: 'HS code / Код ТН ВЭД' },
      { key: 'customsPlace', label: 'Place of Customs clearance / Место ТО' },
      { key: 'invoiceValue', label: 'Invoice value / Инвойсная стоимость' },
      { key: 'invoiceCurrency', label: 'Валюта' },
      { key: 'cargoReadiness', label: 'Readiness / Готовность груза к отгрузке' },
    ],
  },
  {
    title: 'Транспорт',
    fields: [
      { key: 'transportationUnit', label: 'Transportation unit / Тип ТС/ПС' },
      { key: 'transportationUnitCount', label: 'Number of units / Количество ТС/ПС' },
      { key: 'validityOfRates', label: 'Validity of rates / Срок действия ставки' },
      { key: 'transitTime', label: 'Transit time / Транзитное время' },
      { key: 'features', label: 'Features / Особенности перевозки', type: 'textarea' },
    ],
  },
];

const EMPTY_FIELDS: DealFields = {
  title: null, company: null, companyId: null, contact: null, isUrgent: false,
  transportationType: null, requestType: null, managerRate: null,
  netCostFromContractor: null, netCostBreakdown: null, incoterms: null,
  mode: null, direction: null, departureCountry: null, departureAddress: null,
  destinationCountry: null, destinationAddress: null, cargoDescription: null,
  numberOfPlaces: null, weight: null, dimensions: null, volume: null,
  temperatureRegime: null, packingInfo: null, hsCode: null, customsPlace: null,
  invoiceValue: null, invoiceCurrency: null, cargoReadiness: null,
  transportationUnit: null, transportationUnitCount: null,
  validityOfRates: null, transitTime: null, features: null,
};

function CompanySearchField({
  value, companyId, onChange,
}: {
  value: string | null;
  companyId: number | null;
  onChange: (company: string | null, companyId: number | null) => void;
}) {
  const [query, setQuery] = useState(value ?? '');
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. after AI parse)
  useEffect(() => { setQuery(value ?? ''); }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-search when AI populates the field (no companyId yet)
  useEffect(() => {
    if (value && !companyId) {
      searchBitrix(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchBitrix(q: string) {
    if (!q.trim()) { setOptions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ai-deal/companies/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      if (res.ok) setOptions(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    onChange(q || null, null); // clear companyId when user types
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchBitrix(q), 350);
  }

  function handleSelect(opt: CompanyOption) {
    setQuery(opt.title);
    onChange(opt.title, opt.id);
    setOptions([]);
    setOpen(false);
  }

  const isLinked = !!companyId;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: isLinked ? '#22c55e' : '#8fa3b8', flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => { if (query && options.length) setOpen(true); else if (query) searchBitrix(query); }}
          placeholder="Название компании, телефон или e-mail"
          style={{
            width: '100%', padding: '8px 36px 8px 30px', fontSize: 13,
            border: `1.5px solid ${isLinked ? '#22c55e' : '#e5e9f2'}`,
            borderRadius: 8, fontFamily: 'inherit', color: '#1e2a3a',
            outline: 'none', boxSizing: 'border-box',
            background: isLinked ? '#f0fdf4' : '#fff',
          }}
        />
        {loading && <Loader2 size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#8fa3b8', animation: 'spin 1s linear infinite' }} />}
        {isLinked && !loading && <CheckCircle2 size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#22c55e' }} />}
      </div>
      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1.5px solid #e5e9f2', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)', marginTop: 4, overflow: 'hidden',
        }}>
          {options.map((opt) => (
            <div
              key={opt.id}
              onMouseDown={() => handleSelect(opt)}
              style={{
                padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: '#1e2a3a',
                borderBottom: '1px solid #f0f2f7',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f9fc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              {opt.title}
            </div>
          ))}
        </div>
      )}
      {isLinked && (
        <div style={{ fontSize: 11, color: '#22c55e', marginTop: 3 }}>
          Компания привязана · ID {companyId}
        </div>
      )}
    </div>
  );
}

export default function AiDealPage() {
  const [step, setStep] = useState<Step>('input');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fields, setFields] = useState<DealFields>(EMPTY_FIELDS);
  const [error, setError] = useState<string | null>(null);
  const [dealResult, setDealResult] = useState<{ id: number; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  async function handleParse() {
    setError(null);
    setStep('parsing');
    try {
      const formData = new FormData();
      if (inputMode === 'file' && file) {
        formData.append('file', file);
      } else {
        formData.append('text', text);
      }
      const res = await fetch(`${API_URL}/api/ai-deal/parse`, { method: 'POST', headers: authHeaders(), body: formData });
      if (!res.ok) throw new Error(await res.text());
      const data: DealFields = await res.json();
      // Normalize transportationType to match dropdown options
      if (data.transportationType) {
        const raw = data.transportationType.toLowerCase().trim();
        const match = TRANSPORTATION_TYPE_OPTIONS.find((o) => o.toLowerCase() === raw)
          ?? TRANSPORTATION_TYPE_OPTIONS.find((o) => raw.includes(o.toLowerCase()))
          ?? TRANSPORTATION_TYPE_OPTIONS.find((o) => o.toLowerCase().includes(raw));
        data.transportationType = match ?? data.transportationType;
      }
      setFields(data);
      setStep('review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка при распознавании');
      setStep('input');
    }
  }

  async function handleCreate() {
    if (!confirmOnStand('Сделка будет создана в рабочем Битриксе24.')) return;
    setError(null);
    setStep('creating');
    try {
      const res = await fetch(`${API_URL}/api/ai-deal/create`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDealResult(data);
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка при создании сделки');
      setStep('review');
    }
  }

  function updateField(key: keyof DealFields, value: unknown) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setStep('input'); setFile(null); setText(''); setFields(EMPTY_FIELDS);
    setError(null); setDealResult(null);
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Sparkles size={22} color="#4f9cf9" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2a3a', margin: 0 }}>
            Создать сделку через ИИ
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#6b7a99', margin: 0 }}>
          Загрузите документ или вставьте текст — ИИ распознает данные и создаст сделку в Битрикс24
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        {(['input', 'review', 'done'] as const).map((s, i) => {
          const labels = ['1. Загрузка', '2. Проверка', '3. Готово'];
          const active = step === s || (s === 'input' && step === 'parsing') || (s === 'review' && step === 'creating');
          const done = (s === 'input' && ['review', 'creating', 'done'].includes(step)) ||
            (s === 'review' && step === 'done');
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{
                flex: 1, padding: '8px 14px', fontSize: 12, fontWeight: 600,
                background: done ? '#e8f5e9' : active ? '#4f9cf9' : '#f0f2f7',
                color: done ? '#2e7d32' : active ? '#fff' : '#8fa3b8',
                borderRadius: i === 0 ? '8px 0 0 8px' : i === 2 ? '0 8px 8px 0' : 0,
                textAlign: 'center', transition: 'all 0.2s',
              }}>
                {labels[i]}
              </div>
              {i < 2 && <div style={{ width: 1, background: '#dde3ee', alignSelf: 'stretch' }} />}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
          <X size={15} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {/* ── Step 1: Input ── */}
      {(step === 'input' || step === 'parsing') && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e9f2', overflow: 'hidden' }}>
          {/* Mode tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e9f2' }}>
            {(['file', 'text'] as const).map((m) => (
              <button key={m} onClick={() => setInputMode(m)} style={{
                flex: 1, padding: '12px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: inputMode === m ? '#fff' : '#f7f9fc',
                color: inputMode === m ? '#4f9cf9' : '#8fa3b8',
                borderBottom: inputMode === m ? '2px solid #4f9cf9' : '2px solid transparent',
              }}>
                {m === 'file' ? '📎 Загрузить файл' : '📝 Вставить текст'}
              </button>
            ))}
          </div>

          <div style={{ padding: 24 }}>
            {inputMode === 'file' ? (
              <>
                <div
                  style={{
                    border: `2px dashed ${dragOver ? '#4f9cf9' : file ? '#22c55e' : '#d1d9e8'}`,
                    borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? '#eff6ff' : file ? '#f0fdf4' : '#fafbfd',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  {file ? (
                    <div>
                      <FileText size={36} color="#22c55e" style={{ margin: '0 auto 10px' }} />
                      <p style={{ fontWeight: 600, color: '#1e2a3a', margin: '0 0 4px' }}>{file.name}</p>
                      <p style={{ fontSize: 12, color: '#6b7a99', margin: 0 }}>{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={36} color="#8fa3b8" style={{ margin: '0 auto 12px' }} />
                      <p style={{ fontWeight: 600, color: '#1e2a3a', margin: '0 0 6px' }}>Перетащите файл или нажмите для выбора</p>
                      <p style={{ fontSize: 12, color: '#8fa3b8', margin: 0 }}>PDF, Word (.docx), изображения (JPG, PNG)</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
              </>
            ) : (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Вставьте текст запроса, письма или описание груза..."
                style={{
                  width: '100%', minHeight: 180, padding: '12px 14px', fontSize: 13,
                  border: '1.5px solid #d1d9e8', borderRadius: 10, resize: 'vertical',
                  fontFamily: 'inherit', color: '#1e2a3a', outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}

            <button
              onClick={handleParse}
              disabled={step === 'parsing' || (inputMode === 'file' ? !file : !text.trim())}
              style={{
                marginTop: 16, width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700,
                border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                background: step === 'parsing' || (inputMode === 'file' ? !file : !text.trim()) ? '#e5e9f2' : '#4f9cf9',
                color: step === 'parsing' || (inputMode === 'file' ? !file : !text.trim()) ? '#8fa3b8' : '#fff',
                transition: 'all 0.2s',
              }}
            >
              {step === 'parsing' ? (
                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Распознаю данные...</>
              ) : (
                <><Sparkles size={16} /> Распознать данные</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {(step === 'review' || step === 'creating') && (
        <div>
          {FIELD_GROUPS.map((group) => (
            <div key={group.title} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e9f2', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f2f7', background: '#f7f9fc' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#1e2a3a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {group.title}
                </p>
              </div>
              <div style={{ padding: '16px 20px', display: 'grid', gap: 14 }}>
                {group.fields.map(({ key, label, type }) => {
                  const val = fields[key];
                  if (type === 'checkbox') {
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={!!val}
                          onChange={(e) => updateField(key, e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: '#4f9cf9' }} />
                        <span style={{ fontWeight: 500, color: '#1e2a3a' }}>{label}</span>
                      </label>
                    );
                  }
                  return (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7a99', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {label}
                      </label>
                      {key === 'company' ? (
                        <CompanySearchField
                          value={fields.company}
                          companyId={fields.companyId}
                          onChange={(company, companyId) => {
                            setFields((prev) => ({ ...prev, company, companyId }));
                          }}
                        />
                      ) : type === 'select' && key === 'transportationType' ? (
                        <select
                          value={(val as string) ?? ''}
                          onChange={(e) => updateField(key, e.target.value || null)}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1.5px solid #e5e9f2', borderRadius: 8, fontFamily: 'inherit', color: (val as string) ? '#1e2a3a' : '#8fa3b8', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                        >
                          <option value="">— не выбрано —</option>
                          {TRANSPORTATION_TYPE_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : type === 'textarea' ? (
                        <textarea
                          value={(val as string) ?? ''}
                          onChange={(e) => updateField(key, e.target.value || null)}
                          rows={3}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1.5px solid #e5e9f2', borderRadius: 8, resize: 'vertical', fontFamily: 'inherit', color: '#1e2a3a', outline: 'none', boxSizing: 'border-box' }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={(val as string) ?? ''}
                          onChange={(e) => updateField(key, e.target.value || null)}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1.5px solid #e5e9f2', borderRadius: 8, fontFamily: 'inherit', color: '#1e2a3a', outline: 'none', boxSizing: 'border-box' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={reset} style={{
              padding: '12px 24px', fontSize: 13, fontWeight: 600, border: '1.5px solid #d1d9e8',
              borderRadius: 10, cursor: 'pointer', background: '#fff', color: '#6b7a99',
            }}>
              ← Назад
            </button>
            <button onClick={handleCreate} disabled={step === 'creating'} style={{
              flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 700, border: 'none',
              borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              background: step === 'creating' ? '#d1d9e8' : '#1e2a3a',
              color: step === 'creating' ? '#8fa3b8' : '#fff',
            }}>
              {step === 'creating' ? (
                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Создаю сделку в Битрикс24...</>
              ) : (
                'Создать сделку в Битрикс24'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === 'done' && dealResult && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e9f2', padding: 40, textAlign: 'center' }}>
          <CheckCircle2 size={56} color="#22c55e" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e2a3a', margin: '0 0 8px' }}>Сделка создана!</h2>
          <p style={{ fontSize: 13, color: '#6b7a99', margin: '0 0 24px' }}>
            Сделка #{dealResult.id} успешно добавлена в Битрикс24
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href={dealResult.url} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
              background: '#4f9cf9', color: '#fff', borderRadius: 10, textDecoration: 'none',
              fontSize: 13, fontWeight: 700,
            }}>
              <ExternalLink size={15} /> Открыть сделку
            </a>
            <button onClick={reset} style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600,
              border: '1.5px solid #d1d9e8', borderRadius: 10, cursor: 'pointer',
              background: '#fff', color: '#6b7a99',
            }}>
              Создать ещё
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
