import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, CalendarPlus, CheckCircle2, Clock, RefreshCw, FileText } from 'lucide-react';
import { tenderApi, TenderListRow, TenderStatus, TENDER_MODE_LABELS } from '../lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUS: Record<TenderStatus, { label: string; cls: string }> = {
  draft:         { label: 'Черновик',           cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  sent:          { label: 'Отправлен',          cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  collecting:    { label: 'Сбор ставок',        cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  award_pending: { label: 'Ждём подтверждения', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  decided:       { label: 'Выбран',             cls: 'bg-green-50 text-green-700 border-green-200' },
  closed: { label: 'Закрыт', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled:     { label: 'Отменён',            cls: 'bg-red-50 text-red-700 border-red-200' },
};

export default function RateRequestsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TenderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    tenderApi.tenders
      .list()
      .then(setRows)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Запросы ставок</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? 'Загрузка…' : `${rows.length} тендеров`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => navigate('/rate-requests/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} /> Новый запрос
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <FileText size={28} className="mx-auto mb-2 opacity-30" />
            Тендеров пока нет
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const st = STATUS[r.status];
            const responded = r._count.replies;
            const invited = r._count.invites;
            return (
              <Card
                key={r.id}
                size="sm"
                className="cursor-pointer transition-shadow hover:ring-foreground/20"
                onClick={() => navigate(`/rate-requests/${r.id}`)}
              >
                <CardContent className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <MapPin size={14} className="text-primary shrink-0" />
                      <span className="font-semibold text-sm">{r.origin}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold text-sm">{r.destination}</span>
                      {r.mode && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {TENDER_MODE_LABELS[r.mode]}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        {/* Момент создания — timestamptz, показываем в рабочем часовом
                            поясе. Время важно не меньше даты: от него считается,
                            сколько у подрядчиков осталось до дедлайна. */}
                        <CalendarPlus size={11} /> создан{' '}
                        {new Date(r.createdAt).toLocaleString('ru-RU', {
                          timeZone: 'Asia/Tashkent',
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {r.loadingDate && (
                        <span className="flex items-center gap-1">
                          {/* Дата погрузки — @db.Date (UTC-полночь): без timeZone съезжает на день назад.
                              Подписываем обе даты: рядом без подписей они путаются. */}
                          <Calendar size={11} /> погрузка{' '}
                          {new Date(r.loadingDate).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}
                        </span>
                      )}
                      {r.weightKg && <span>{Number(r.weightKg).toLocaleString('ru-RU')} кг</span>}
                      {r.cargo && <span className="truncate max-w-[220px]">{r.cargo}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', st.cls)}>
                      {st.label}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {r.status === 'decided' ? (
                        <><CheckCircle2 size={12} className="text-green-600" /> Победитель выбран</>
                      ) : (
                        <><Clock size={12} /> {responded}/{invited} ответов</>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
