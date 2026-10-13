import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { memoApi } from '@/lib/api';
import type { MemoCard, MemoInput, MemoMeta, MemoType } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { MEMO_TYPE } from './memo-meta';

const selectCls =
  'h-9 w-full rounded-md border bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

/**
 * Создание и правка записки.
 *
 * Поля, своеобразные для типа, приходят с сервера в `meta` и рисуются по
 * описанию — так новое поле не требует правки фронта. Проверка здесь мягкая:
 * черновик можно сохранить недозаполненным, иначе нельзя отложить работу.
 * Отправку проверяет сервер и говорит, чего не хватает.
 */
export default function MemoForm({
  meta,
  memo,
  onClose,
  onSaved,
}: {
  meta: MemoMeta;
  /** Пусто — создаём новую. */
  memo?: MemoCard;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const editing = !!memo;
  const [type, setType] = useState<MemoType>(memo?.memoType ?? 'payment');
  const [title, setTitle] = useState(memo?.title ?? '');
  const [departmentId, setDepartmentId] = useState(memo?.department?.id ?? '');
  const [justification, setJustification] = useState(memo?.justification ?? '');
  const [amount, setAmount] = useState(memo?.amount ?? '');
  const [currency, setCurrency] = useState(memo?.currency ?? 'UZS');
  const [payload, setPayload] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    Object.entries(memo?.payload ?? {}).forEach(([k, v]) => {
      out[k] = String(v);
    });
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = meta.types.find((t) => t.type === type);
  const fields = spec?.fields ?? [];
  const setField = (key: string, value: string) =>
    setPayload((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const input: MemoInput = {
        memoType: type,
        title: title.trim(),
        justification: justification.trim(),
        departmentId: departmentId || undefined,
        amount: amount === '' ? undefined : Number(amount),
        currency: amount === '' ? undefined : currency,
        payload,
      };
      const saved = editing
        ? await memoApi.update(memo!.id, { ...input, memoType: undefined })
        : await memoApi.create(input);
      onSaved(saved.id);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  // Кнопку держим активной, пока заполнено минимально необходимое для
  // черновика: заголовок и обоснование. Остальное досказывает сервер.
  const ready = title.trim().length >= 3 && justification.trim().length >= 5;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-background shadow-xl p-5 overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-sm">
            {editing ? `Правка записки ${memo!.number ?? ''}` : 'Новая служебная записка'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {!editing && (
          <div className="space-y-1.5">
            <Label>Тип записки *</Label>
            <div className="grid grid-cols-2 gap-2">
              {meta.types.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setType(t.type)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left',
                    type === t.type
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted/50',
                  )}
                >
                  {MEMO_TYPE[t.type].label}
                </button>
              ))}
            </div>
          </div>
        )}
        {editing && (
          <p className="text-xs text-muted-foreground">
            Тип записки изменить нельзя — для другого типа создайте новую.
          </p>
        )}

        <div className="space-y-1.5">
          <Label>Заголовок *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Коротко о чём записка"
            maxLength={300}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Подразделение</Label>
          <select
            className={selectCls}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">— не указано —</option>
            {meta.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1.5">
            <Label>Сумма {spec?.amountRequired ? '*' : ''}</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Валюта</Label>
            <select
              className={selectCls}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {meta.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {fields.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="text-xs font-medium text-muted-foreground">
              {MEMO_TYPE[type].label} — подробности
            </div>
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>
                  {field.label} {field.required ? '*' : ''}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    value={payload[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    rows={3}
                    maxLength={field.maxLength}
                  />
                ) : (
                  <Input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    value={payload[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    maxLength={field.maxLength}
                  />
                )}
                {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Обоснование *</Label>
          <Textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="Зачем это нужно — именно это читают согласующие"
          />
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="space-y-2 pt-1">
          <button
            onClick={save}
            disabled={saving || !ready}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40',
            )}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {editing ? 'Сохранить' : 'Создать черновик'}
          </button>
          <p className="text-xs text-muted-foreground">
            {editing
              ? 'После сохранения записку можно отправить на согласование из её карточки.'
              : 'Записка сохранится черновиком. Файлы приложите и отправьте на согласование в карточке.'}
          </p>
        </div>
      </div>
    </div>
  );
}
