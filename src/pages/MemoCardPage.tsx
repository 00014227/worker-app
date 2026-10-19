import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Check,
  Download,
  Loader2,
  Paperclip,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { memoApi } from '@/lib/api';
import type { MemoCard, MemoDecisionKind, MemoMeta } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import MemoForm from '@/components/memos/MemoForm';
import MemoRouteTimeline from '@/components/memos/MemoRouteTimeline';
import {
  EVENT_LABEL,
  MEMO_STATUS,
  MEMO_TYPE,
  fmtDateTime,
  fmtMoney,
  fmtSize,
  optionLabel,
} from '@/components/memos/memo-meta';

export default function MemoCardPage() {
  const { id = '' } = useParams();

  const [memo, setMemo] = useState<MemoCard | null>(null);
  const [meta, setMeta] = useState<MemoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const card = await memoApi.byId(id);
      setMemo(card);
      // Чего не хватает для отправки — спрашиваем сервер, чтобы правила
      // проверки лежали в одном месте, а не повторялись во фронте.
      if (card.canEdit) {
        const ready = await memoApi.readiness(id);
        setProblems(ready.problems);
      } else {
        setProblems([]);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [card, m] = await Promise.all([memoApi.byId(id), memoApi.meta()]);
        setMemo(card);
        setMeta(m);
        if (card.canEdit) setProblems((await memoApi.readiness(id)).problems);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const submit = async () => {
    if (!memo) return;
    setBusy(true);
    setError(null);
    try {
      await memoApi.submit(memo.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!memo) return;
    if (!window.confirm('Отменить записку? Открытые задачи согласования будут сняты.')) return;
    setBusy(true);
    try {
      await memoApi.cancel(memo.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        <Loader2 size={20} className="mx-auto mb-2 animate-spin opacity-50" />
        Открываем записку…
      </div>
    );
  }

  if (!memo) {
    return (
      <div className="space-y-3">
        <Link to="/memos" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={12} /> К реестру
        </Link>
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Записка не найдена'}
        </div>
      </div>
    );
  }

  const status = MEMO_STATUS[memo.status];
  const fields = meta?.types.find((t) => t.type === memo.memoType)?.fields ?? [];

  return (
    <div className="space-y-4">
      <Link to="/memos" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={12} /> К реестру
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{memo.number ?? 'Черновик'}</h1>
            <span className={cn('px-2 py-0.5 rounded border text-xs font-medium', status.chip)}>
              {status.label}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded border bg-muted/50">
              {MEMO_TYPE[memo.memoType].label}
            </span>
          </div>
          <p className="text-sm mt-1">{memo.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {memo.authorName}
            {memo.department && ` · ${memo.department.name}`} · создана {fmtDateTime(memo.createdAt)}
            {memo.submittedAt && ` · отправлена ${fmtDateTime(memo.submittedAt)}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {memo.canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/50"
            >
              <Pencil size={13} /> Править
            </button>
          )}
          {memo.canCancel && (
            <button
              onClick={cancel}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/50 disabled:opacity-40"
            >
              <Ban size={13} /> Отменить
            </button>
          )}
          {memo.canEdit && (
            <button
              onClick={submit}
              disabled={busy || problems.length > 0}
              title={problems.length ? problems.join('; ') : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {memo.status === 'changes_requested' ? 'Отправить повторно' : 'Отправить'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Чего не хватает для отправки — говорим до нажатия кнопки. */}
      {memo.canEdit && problems.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <div className="flex items-start gap-2">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            <div>
              <b>Нельзя отправить, пока не заполнено:</b>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Повторная подача идёт с шага, который вернул — объясняем, чтобы автор
          не искал, почему маршрут не начался заново. */}
      {memo.status === 'changes_requested' && memo.isAuthor && (
        <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
          <RotateCcw size={13} className="mt-0.5 shrink-0" />
          <span>
            Записку вернули на доработку. После исправления она пойдёт <b>к тому же
            согласующему</b>, который её вернул — ранее данные согласования сохраняются и заново
            не запрашиваются.
          </span>
        </div>
      )}

      {memo.myTaskId && (
        <DecisionPanel
          memoId={memo.id}
          taskId={memo.myTaskId}
          onDone={load}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-4">
              <Row label="Сумма" value={fmtMoney(memo.amount, memo.currency)} />
              {fields.map((f) => {
                const value = memo.payload[f.key];
                if (value === undefined || value === '') return null;
                // Для выбора показываем подпись: в базе лежит значение, и
                // согласующий иначе читал бы «vacation» вместо «Отпуск».
                return <Row key={f.key} label={f.label} value={optionLabel(f, value)} />;
              })}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Обоснование</div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {memo.justification}
                </div>
              </div>
            </CardContent>
          </Card>

          <Attachments memo={memo} onChanged={load} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="text-xs font-medium">Маршрут согласования</div>
              <MemoRouteTimeline route={memo.route} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-1.5">
              <div className="text-xs font-medium mb-1">Что происходило</div>
              {memo.events.map((e, i) => (
                <div key={i} className="text-xs flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {fmtDateTime(e.createdAt)}
                  </span>
                  <span>{EVENT_LABEL[e.kind] ?? e.kind}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && meta && (
        <MemoForm
          meta={meta}
          memo={memo}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}

/**
 * Панель решения.
 *
 * Для возврата и отказа комментарий обязателен: без причины автор не поймёт,
 * что исправлять. Сервер это тоже проверяет — кнопка здесь лишь не даёт
 * отправить заведомо неполное.
 */
function DecisionPanel({
  memoId,
  taskId,
  onDone,
}: {
  memoId: string;
  taskId: string;
  onDone: () => Promise<void>;
}) {
  const [kind, setKind] = useState<MemoDecisionKind | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsComment = kind === 'reject' || kind === 'return';

  const send = async () => {
    if (!kind) return;
    setBusy(true);
    setError(null);
    try {
      await memoApi.decide(memoId, taskId, kind, comment.trim() || undefined);
      setKind(null);
      setComment('');
      await onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-blue-300 bg-blue-50/40">
      <CardContent className="pt-4 space-y-3">
        <div className="text-sm font-medium">Записка ждёт вашего решения</div>

        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { k: 'approve' as const, label: 'Согласовать', icon: Check, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' },
              { k: 'return' as const, label: 'На доработку', icon: RotateCcw, cls: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' },
              { k: 'reject' as const, label: 'Отклонить', icon: X, cls: 'bg-red-600 hover:bg-red-700 text-white border-red-600' },
            ] satisfies { k: MemoDecisionKind; label: string; icon: typeof Check; cls: string }[]
          ).map(({ k, label, icon: Icon, cls }) => (
            <button
              key={k}
              onClick={() => setKind(kind === k ? null : k)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                kind === k ? cls : 'bg-background hover:bg-muted/50',
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {kind && (
          <div className="space-y-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={
                needsComment
                  ? 'Причина обязательна — что именно не так и что исправить'
                  : 'Комментарий (необязательно)'
              }
            />
            {error && <div className="text-xs text-red-600">{error}</div>}
            <button
              onClick={send}
              disabled={busy || (needsComment && comment.trim().length < 3)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              {busy && <Loader2 size={13} className="animate-spin" />}
              Подтвердить решение
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Вложения: приложить можно, пока записку можно править. */
function Attachments({ memo, onChanged }: { memo: MemoCard; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await memoApi.addAttachment(memo.id, file);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = async (attachmentId: string, name: string) => {
    try {
      const url = await memoApi.attachmentUrl(memo.id, attachmentId);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      a.download = name;
      a.click();
      // Ссылку отзываем с задержкой: мгновенный отзыв рвёт открытие в Safari.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (attachmentId: string) => {
    if (!window.confirm('Убрать вложение?')) return;
    setBusy(true);
    try {
      await memoApi.removeAttachment(memo.id, attachmentId);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium flex items-center gap-1.5">
            <Paperclip size={13} /> Документы ({memo.attachments.length})
          </div>
          {memo.canEdit && (
            <label className="text-xs text-primary hover:underline cursor-pointer">
              {busy ? 'Загружаем…' : 'Приложить файл'}
              <input
                type="file"
                className="hidden"
                disabled={busy}
                accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  void pick(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        {memo.attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {memo.canEdit
              ? 'Счёт, договор, акт — приложите то, на что ссылаетесь в обосновании.'
              : 'Документов нет.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {memo.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => open(a.id, a.name)}
                  className="text-primary hover:underline inline-flex items-center gap-1 min-w-0 flex-1 text-left"
                >
                  <Download size={11} className="shrink-0" />
                  <span className="truncate">{a.name}</span>
                </button>
                <span className="text-muted-foreground shrink-0">{fmtSize(a.size)}</span>
                {memo.canEdit && (
                  <button
                    onClick={() => remove(a.id)}
                    className="text-muted-foreground hover:text-red-600 shrink-0"
                    title="Убрать"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
