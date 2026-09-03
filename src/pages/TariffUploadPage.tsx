import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  Check,
  Pencil,
  X,
  Save,
} from 'lucide-react';
import {
  uploadTariffFile,
  getTariffBatch,
  updateTariffRow,
  commitTariffBatch,
  type TariffUploadBatch,
  type TariffUploadRow,
} from '../lib/api';

type Step = 'upload' | 'preview' | 'done';

const TRANSPORT_OPTIONS = [
  { value: 'auto', label: 'Авто' },
  { value: 'rail', label: 'ЖД' },
  { value: 'sea', label: 'Море' },
  { value: 'air', label: 'Авиа' },
  { value: 'multimodal', label: 'Мультимодальная' },
];

function StatusBadge({ status }: { status: TariffUploadRow['rowStatus'] }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" />
        OK
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
        <AlertTriangle className="h-3 w-3" />
        Предупрежд.
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      <AlertCircle className="h-3 w-3" />
      Ошибка
    </span>
  );
}

interface EditingRow {
  rowId: string;
  departure: string;
  destination: string;
  transportType: string;
  currency: string;
  ratePerKg: string;
  ratePerCbm: string;
  ratePerContainer: string;
  minCost: string;
  validFrom: string;
  validUntil: string;
  notes: string;
}

export default function TariffUploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [sourceType, setSourceType] = useState<'indicative' | 'b24'>(
    'indicative',
  );
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<TariffUploadBatch | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    committed: number;
    skipped: number;
  } | null>(null);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [savingRow, setSavingRow] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const result = await uploadTariffFile(file, sourceType);
        const batchData = await getTariffBatch(result.batchId);
        setBatch(batchData);
        setStep('preview');
      } catch (e) {
        setError(String(e));
      } finally {
        setUploading(false);
      }
    },
    [sourceType],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const startEdit = (row: TariffUploadRow) => {
    setEditingRow({
      rowId: row.id,
      departure: row.departure ?? '',
      destination: row.destination ?? '',
      transportType: row.transportType ?? 'auto',
      currency: row.currency ?? 'USD',
      ratePerKg: row.ratePerKg ?? '',
      ratePerCbm: row.ratePerCbm ?? '',
      ratePerContainer: row.ratePerContainer ?? '',
      minCost: row.minCost ?? '',
      validFrom: row.validFrom?.slice(0, 10) ?? '',
      validUntil: row.validUntil?.slice(0, 10) ?? '',
      notes: row.notes ?? '',
    });
  };

  const saveEdit = async () => {
    if (!editingRow || !batch) return;
    setSavingRow(true);
    try {
      await updateTariffRow(batch.id, editingRow.rowId, {
        departure: editingRow.departure || undefined,
        destination: editingRow.destination || undefined,
        transportType: editingRow.transportType || undefined,
        currency: editingRow.currency || undefined,
        ratePerKg: editingRow.ratePerKg ? Number(editingRow.ratePerKg) : null,
        ratePerCbm: editingRow.ratePerCbm
          ? Number(editingRow.ratePerCbm)
          : null,
        ratePerContainer: editingRow.ratePerContainer
          ? Number(editingRow.ratePerContainer)
          : null,
        minCost: editingRow.minCost ? Number(editingRow.minCost) : null,
        validFrom: editingRow.validFrom || undefined,
        validUntil: editingRow.validUntil || undefined,
        notes: editingRow.notes || null,
      });
      const refreshed = await getTariffBatch(batch.id);
      setBatch(refreshed);
      setEditingRow(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingRow(false);
    }
  };

  const handleCommit = async () => {
    if (!batch) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await commitTariffBatch(batch.id);
      setCommitResult({ committed: result.committed, skipped: result.skipped });
      setStep('done');
    } catch (e) {
      setError(String(e));
    } finally {
      setCommitting(false);
    }
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done' && commitResult) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">
            Тарифы загружены
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Добавлено: {commitResult.committed}, пропущено:{' '}
            {commitResult.skipped}
          </p>
        </div>
        <button
          onClick={() => navigate('/tariffs')}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          Перейти к тарифам
        </button>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if (step === 'preview' && batch) {
    const okCount = batch.rows.filter((r) => r.rowStatus === 'ok').length;
    const errCount = batch.rows.filter((r) => r.rowStatus === 'error').length;
    const warnCount = batch.rows.filter(
      (r) => r.rowStatus === 'warning',
    ).length;

    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setStep('upload');
              setBatch(null);
            }}
            className="text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Предпросмотр тарифов
            </h1>
            <p className="text-sm text-slate-500">
              {batch.fileName} · {batch.totalRows} строк
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            {okCount} OK
          </div>
          {warnCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              {warnCount} предупреждений
            </div>
          )}
          {errCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {errCount} ошибок
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Preview table */}
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 text-left">#</th>
                <th className="px-3 py-2.5 text-left">Откуда</th>
                <th className="px-3 py-2.5 text-left">Куда</th>
                <th className="px-3 py-2.5 text-left">Тип</th>
                <th className="px-3 py-2.5 text-left">Валюта</th>
                <th className="px-3 py-2.5 text-left">/кг</th>
                <th className="px-3 py-2.5 text-left">/м³</th>
                <th className="px-3 py-2.5 text-left">/конт</th>
                <th className="px-3 py-2.5 text-left">Действует</th>
                <th className="px-3 py-2.5 text-left">Статус</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {batch.rows.map((row) => {
                const isEditing = editingRow?.rowId === row.id;
                if (isEditing && editingRow) {
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 bg-blue-50/30"
                    >
                      <td className="px-3 py-2 text-slate-400">
                        {row.rowIndex + 1}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editingRow.departure}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              departure: e.target.value,
                            })
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editingRow.destination}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              destination: e.target.value,
                            })
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editingRow.transportType}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              transportType: e.target.value,
                            })
                          }
                          className="rounded border border-slate-300 px-1 py-1 text-xs focus:border-primary focus:outline-none"
                        >
                          {TRANSPORT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editingRow.currency}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              currency: e.target.value,
                            })
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editingRow.ratePerKg}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              ratePerKg: e.target.value,
                            })
                          }
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editingRow.ratePerCbm}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              ratePerCbm: e.target.value,
                            })
                          }
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editingRow.ratePerContainer}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              ratePerContainer: e.target.value,
                            })
                          }
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={editingRow.validFrom}
                            onChange={(e) =>
                              setEditingRow({
                                ...editingRow,
                                validFrom: e.target.value,
                              })
                            }
                            className="rounded border border-slate-300 px-1 py-1 text-xs focus:border-primary focus:outline-none"
                          />
                          <input
                            type="date"
                            value={editingRow.validUntil}
                            onChange={(e) =>
                              setEditingRow({
                                ...editingRow,
                                validUntil: e.target.value,
                              })
                            }
                            className="rounded border border-slate-300 px-1 py-1 text-xs focus:border-primary focus:outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={savingRow}
                            className="rounded bg-primary p-1 text-white hover:bg-primary/90 disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingRow(null)}
                            className="rounded bg-slate-100 p-1 text-slate-600 hover:bg-slate-200"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-50 ${
                      row.rowStatus === 'error'
                        ? 'bg-red-50/30'
                        : row.rowStatus === 'warning'
                          ? 'bg-yellow-50/20'
                          : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-slate-400">
                      {row.rowIndex + 1}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {row.departureLocation?.name ?? row.departure ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {row.destinationLocation?.name ?? row.destination ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.transportType ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.currency ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.ratePerKg ? Number(row.ratePerKg).toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.ratePerCbm ? Number(row.ratePerCbm).toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.ratePerContainer
                        ? Number(row.ratePerContainer).toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {row.validFrom?.slice(0, 10) ?? '—'} —{' '}
                      {row.validUntil?.slice(0, 10) ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge status={row.rowStatus} />
                        {row.errorMessage && (
                          <span className="text-xs text-red-500">
                            {row.errorMessage}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => startEdit(row)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-500">
            {okCount} строк будет добавлено
            {errCount > 0 ? `, ${errCount} строк пропущено (ошибки)` : ''}
          </p>
          <button
            onClick={handleCommit}
            disabled={committing || okCount === 0}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {committing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {committing ? 'Сохранение...' : `Сохранить ${okCount} тарифов`}
          </button>
        </div>
      </div>
    );
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/tariffs')}
          className="text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-900">
          Загрузить тарифы
        </h1>
      </div>

      <div className="mx-auto w-full max-w-lg space-y-5">
        {/* Source type */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-slate-700">
            Источник тарифов
          </p>
          <div className="flex gap-3">
            {(['indicative', 'b24'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSourceType(type)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                  sourceType === type
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {type === 'indicative' ? 'Индикативный' : 'Битрикс24'}
              </button>
            ))}
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition ${
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {uploading ? (
            <>
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
              <p className="text-sm text-slate-500">Анализ файла...</p>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Upload className="h-6 w-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">
                  Перетащите файл или нажмите для выбора
                </p>
                <p className="mt-1 text-xs text-slate-400">CSV, XLSX, XLS</p>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
