import { DiffAdvice, DiffKind, DiffRisk, DiffSide } from '@/lib/api';

/**
 * Оформление уровней риска. Красный только для высокого: если раскрасить
 * тревожно всё, юрист перестанет различать, где действительно горит.
 */
export const RISK: Record<
  DiffRisk,
  { label: string; chip: string; dot: string; order: number }
> = {
  high: {
    label: 'Высокий риск',
    chip: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    order: 0,
  },
  medium: {
    label: 'Стоит обсудить',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    order: 1,
  },
  low: {
    label: 'Незначительно',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
    order: 2,
  },
};

export const KIND: Record<
  Exclude<DiffKind, 'same'>,
  { label: string; chip: string }
> = {
  modified: {
    label: 'изменён',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  added: {
    label: 'добавлен',
    chip: 'bg-green-50 text-green-700 border-green-200',
  },
  removed: { label: 'удалён', chip: 'bg-red-50 text-red-700 border-red-200' },
  moved: {
    label: 'перенесён',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

export const ADVICE: Record<DiffAdvice, { label: string; chip: string }> = {
  accept: {
    label: 'Можно принять',
    chip: 'bg-green-50 text-green-700 border-green-200',
  },
  discuss: {
    label: 'Обсудить',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  reject: { label: 'Отклонить', chip: 'bg-red-50 text-red-700 border-red-200' },
};

export const SIDE: Record<DiffSide, string> = {
  us: 'в нашу пользу',
  counterparty: 'в пользу контрагента',
  neutral: 'нейтрально',
};

/** Правки без оценки модели ставим после оценённых, а не в начало. */
export function riskOrder(risk: DiffRisk | null): number {
  return risk ? RISK[risk].order : 3;
}
