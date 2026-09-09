import { ContractDiff, DiffItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import ClauseText from './ClauseText';
import ChangeCard from './ChangeCard';
import { KIND, RISK } from './diff-meta';

/**
 * Договор целиком, с правками, подсвеченными по месту.
 *
 * Юрист читает договор подряд, а не список вырванных фрагментов: смысл пункта
 * часто задаётся соседними. Поэтому текст идёт сплошняком, изменённые пункты
 * выделены цветом и пословной разметкой, а разбор раскрывается тут же, под
 * пунктом — не приходится прыгать между колонкой правок и текстом.
 *
 * Нетронутые пункты показываем приглушённо: они нужны для чтения, но взгляд
 * должны притягивать не они.
 */
export default function DocumentView({
  report,
  activeId,
  openIds,
  onToggle,
  rowsRef,
}: {
  report: ContractDiff;
  activeId: string | null;
  openIds: Set<string>;
  onToggle: (id: string) => void;
  rowsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  // Правки лежат в items в том же порядке, в каком изменённые пункты идут в
  // clauses — связываем их по порядку, а не по номеру: номера повторяются.
  const itemAt = new Map<number, DiffItem>();
  let k = 0;
  report.clauses.forEach((c, i) => {
    if (c.kind !== 'same' && report.items[k]) itemAt.set(i, report.items[k++]);
  });

  return (
    <div className="rounded-xl border divide-y">
      {report.clauses.map((c, i) => {
        const item = itemAt.get(i);
        const number = c.rightNumber ?? c.leftNumber;
        const risk = item?.risk ? RISK[item.risk] : null;
        const kind = c.kind !== 'same' ? KIND[c.kind] : null;
        const open = item ? openIds.has(item.id) : false;

        // ── Нетронутый пункт ──
        if (!item) {
          return (
            <div
              key={i}
              className="px-4 py-2 text-xs leading-relaxed text-muted-foreground"
            >
              {number && <span className="font-medium mr-1.5">{number}.</span>}
              {c.after ?? c.before}
            </div>
          );
        }

        // ── Пункт с правкой ──
        return (
          <div
            key={i}
            ref={(el) => {
              rowsRef.current[item.id] = el;
            }}
            className={cn(
              'border-l-[3px] transition-colors',
              item.risk === 'high'
                ? 'border-l-red-500 bg-red-50/40'
                : item.risk === 'medium'
                  ? 'border-l-amber-500 bg-amber-50/40'
                  : 'border-l-slate-300 bg-slate-50/40',
              activeId === item.id && 'ring-2 ring-inset ring-primary/30',
            )}
          >
            <button
              onClick={() => onToggle(item.id)}
              className="w-full text-left px-4 py-2.5 hover:bg-black/[0.02] transition-colors"
            >
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {number && (
                  <span className="text-xs font-semibold">п. {number}</span>
                )}
                {kind && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded border text-[10px] font-medium',
                      kind.chip,
                    )}
                  >
                    {kind.label}
                  </span>
                )}
                {risk && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded border text-[10px] font-medium',
                      risk.chip,
                    )}
                  >
                    {risk.label}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {open ? 'свернуть' : 'разбор'}
                </span>
              </div>

              {/* Сам текст с пословной разметкой: вставленное зелёным,
                  вычеркнутое красным — видно прямо в теле договора. */}
              <div className="text-xs leading-relaxed">
                {c.kind === 'removed' ? (
                  <span className="line-through text-red-800/70">
                    {c.before}
                  </span>
                ) : (
                  <ClauseText
                    parts={c.parts}
                    text={c.after ?? c.before}
                    side="right"
                  />
                )}
              </div>
            </button>

            {open && (
              <div className="px-4 pb-3">
                <ChangeCard item={item} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
