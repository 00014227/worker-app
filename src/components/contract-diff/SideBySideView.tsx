import { ContractDiff, DiffItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import ClauseText from './ClauseText';
import ChangeCard from './ChangeCard';
import { KIND, RISK } from './diff-meta';

/**
 * Две версии договора рядом: слева исходная, справа присланная.
 *
 * Юрист привык сверять пункт с пунктом глазами, а не читать склеенный документ
 * со вставками. Одна пара пунктов — одна строка, поэтому синхронизировать
 * прокрутку не нужно вовсе: колонки выровнены по устройству, а не по высоте
 * пикселей, как это выходит при двух независимых полосах прокрутки.
 *
 * Разбор раскрывается под строкой на всю ширину — иначе пришлось бы выбирать,
 * в какой колонке его читать.
 */
export default function SideBySideView({
  report,
  activeId,
  openIds,
  onToggle,
  onOriginal,
  rowsRef,
  onlyChanges,
}: {
  report: ContractDiff;
  activeId: string | null;
  openIds: Set<string>;
  onToggle: (id: string) => void;
  onOriginal?: (side: 'left' | 'right', page: number | null) => void;
  rowsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onlyChanges: boolean;
}) {
  // Правки лежат в items в том же порядке, в каком изменённые пункты идут в
  // clauses — связываем по порядку, а не по номеру: номера повторяются.
  const itemAt = new Map<number, DiffItem>();
  let k = 0;
  report.clauses.forEach((c, i) => {
    if (c.kind !== 'same' && report.items[k]) itemAt.set(i, report.items[k++]);
  });

  const rows = report.clauses
    .map((c, i) => ({ c, i, item: itemAt.get(i) }))
    .filter((r) => !onlyChanges || r.item);

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Шапка с именами файлов: без неё через минуту непонятно, где чей текст. */}
      <div className="grid grid-cols-2 gap-px bg-border sticky top-0 z-10">
        <div className="bg-muted/60 px-4 py-2 text-xs font-medium truncate">
          {report.leftName}
          {report.leftOcr && (
            <span className="ml-1.5 text-[10px] font-normal text-amber-700">
              распознано
            </span>
          )}
        </div>
        <div className="bg-muted/60 px-4 py-2 text-xs font-medium truncate">
          {report.rightName}
          {report.rightOcr && (
            <span className="ml-1.5 text-[10px] font-normal text-amber-700">
              распознано
            </span>
          )}
        </div>
      </div>

      <div className="divide-y">
        {rows.map(({ c, i, item }) => {
          const number = c.rightNumber ?? c.leftNumber;
          const risk = item?.risk ? RISK[item.risk] : null;
          const kind = c.kind !== 'same' ? KIND[c.kind] : null;
          const open = item ? openIds.has(item.id) : false;

          return (
            <div
              key={i}
              ref={(el) => {
                if (item) rowsRef.current[item.id] = el;
              }}
              className={cn(
                'border-l-[3px]',
                item?.risk === 'high'
                  ? 'border-l-red-500 bg-red-50/30'
                  : item?.risk === 'medium'
                    ? 'border-l-amber-500 bg-amber-50/30'
                    : item
                      ? 'border-l-slate-300 bg-slate-50/30'
                      : 'border-l-transparent',
                item &&
                  activeId === item.id &&
                  'ring-2 ring-inset ring-primary/30',
              )}
            >
              {/* Заголовок строки: номер пункта, вид правки, риск. */}
              {item && (
                <div className="flex items-center gap-1.5 flex-wrap px-4 pt-2">
                  <span className="text-xs font-semibold">
                    п. {number ?? '—'}
                  </span>
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
                  <button
                    onClick={() => onToggle(item.id)}
                    className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {open ? 'свернуть разбор' : 'разбор'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-px bg-border/60">
                <Half
                  text={c.before}
                  parts={c.parts}
                  side="left"
                  number={c.leftNumber}
                  plain={!item}
                  missing="пункта не было"
                  page={c.leftPage ?? null}
                  onOriginal={
                    onOriginal && (() => onOriginal('left', c.leftPage ?? null))
                  }
                />
                <Half
                  text={c.after}
                  parts={c.parts}
                  side="right"
                  number={c.rightNumber}
                  plain={!item}
                  missing="пункт удалён"
                  page={c.rightPage ?? null}
                  onOriginal={
                    onOriginal &&
                    (() => onOriginal('right', c.rightPage ?? null))
                  }
                />
              </div>

              {open && item && (
                <div className="px-4 pb-3 pt-1">
                  <ChangeCard item={item} />
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Под фильтр ничего не попало
          </p>
        )}
      </div>
    </div>
  );
}

/** Одна половина строки — текст пункта в своей версии договора. */
function Half({
  text,
  parts,
  side,
  number,
  plain,
  missing,
  page,
  onOriginal,
}: {
  text: string | null;
  parts: { kind: 'same' | 'added' | 'removed'; text: string }[] | null;
  side: 'left' | 'right';
  number: string | null;
  plain: boolean;
  missing: string;
  page: number | null;
  onOriginal?: () => void;
}) {
  return (
    <div className="bg-background px-4 py-2 min-w-0">
      {text ? (
        <div
          className={cn(
            'text-xs leading-relaxed break-words',
            plain && 'text-muted-foreground',
          )}
        >
          {number && <span className="font-medium mr-1.5">{number}.</span>}
          <ClauseText parts={parts} text={text} side={side} />
          {/* Кнопка к подлиннику: распознанному тексту юрист на слово не поверит,
              и возможность за один клик увидеть страницу решает дело. */}
          {onOriginal && !plain && (
            <button
              onClick={onOriginal}
              className="ml-1.5 text-[10px] text-primary hover:underline whitespace-nowrap"
            >
              оригинал{page ? ` · стр. ${page}` : ''}
            </button>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">{missing}</div>
      )}
    </div>
  );
}
