import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { MemoExtraExpenseView } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { fmtMoney, REBILLED_LABEL } from './memo-meta';

/**
 * Табличная часть обоснования доп. расходов.
 *
 * Общий обход `fields` эту записку не нарисует: её строки лежат отдельными
 * таблицами, а не в `payload`, и описания полей у типа нет вовсе.
 *
 * Все разницы и итоги приходят с сервера посчитанными — складывать деньги в
 * браузере нельзя, они приходят строками и на сложении копейки поплывут.
 */
export default function MemoExtraExpenseBlock({
  extra,
}: {
  extra: MemoExtraExpenseView;
}) {
  const { currency } = extra;
  const savings = Number(extra.expenseOverrun) < 0;

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-xs font-medium">Расходы по перевозке</div>
          {/* Ссылка есть, только если по номеру нашлась ровно одна перевозка:
              номера заказов в базе не уникальны. Номер показываем всегда — он
              остаётся главным, ссылка лишь удобство. */}
          {extra.orderId ? (
            <Link
              to={`/shipments/${extra.orderId}`}
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              {extra.orderNumber}
              <ExternalLink size={12} />
            </Link>
          ) : (
            <span className="text-sm font-medium">{extra.orderNumber}</span>
          )}
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="text-left font-normal pb-1.5">Вид расхода</th>
                <th className="text-right font-normal pb-1.5 pl-3">План</th>
                <th className="text-right font-normal pb-1.5 pl-3">Факт</th>
                <th className="text-right font-normal pb-1.5 pl-3">Разница</th>
              </tr>
            </thead>
            <tbody>
              {extra.lines.map((line, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5 pr-2 break-words">
                    {line.expenseType}
                  </td>
                  <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap">
                    {fmtMoney(line.planned, null)}
                  </td>
                  <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap">
                    {fmtMoney(line.actual, null)}
                  </td>
                  <td
                    className={`py-1.5 pl-3 text-right tabular-nums whitespace-nowrap ${diffClass(line.diff)}`}
                  >
                    {signed(line.diff)}
                  </td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td className="py-1.5 pr-2">Итого</td>
                <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap">
                  {fmtMoney(extra.plannedTotal, null)}
                </td>
                <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap">
                  {fmtMoney(extra.actualTotal, null)}
                </td>
                <td
                  className={`py-1.5 pl-3 text-right tabular-nums whitespace-nowrap ${diffClass(extra.expenseOverrun)}`}
                >
                  {signed(extra.expenseOverrun)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Превышение — то, из-за чего записка и существует: крупно и отдельно. */}
        <div className="rounded-lg border bg-muted/40 px-4 py-2.5 flex items-baseline justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {savings ? 'Экономия по расходам' : 'Превышение по расходам'}
          </span>
          <span
            className={`text-base font-semibold ${diffClass(extra.expenseOverrun)}`}
          >
            {signed(extra.expenseOverrun)} {currency ?? ''}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium">Доход по перевозке</div>
          <Row
            label="Планируемый"
            value={fmtMoney(extra.incomePlanned, currency)}
          />
          <Row
            label="Фактический"
            value={fmtMoney(extra.incomeActual, currency)}
          />
          <Row
            label="Разница"
            value={`${signed(extra.incomeDiff)} ${currency ?? ''}`.trim()}
            // У дохода рост — это хорошо, поэтому цвет считается наоборот.
            className={diffClass(extra.incomeDiff, true)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium">Перевыставление клиенту</div>
          <Row
            label="Расход клиенту"
            value={REBILLED_LABEL[extra.rebilled] ?? extra.rebilled}
          />
          {/* Виноватого спрашивают только когда расход клиенту не перевыставлен. */}
          {extra.culprit && <Row label="По чьей вине" value={extra.culprit} />}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`text-right break-words ${className ?? ''}`}>
        {value}
      </span>
    </div>
  );
}

/** Со знаком: по нему сразу видно перерасход это или экономия. */
function signed(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) return fmtMoney(amount, null);
  return `${value > 0 ? '+' : '−'}${fmtMoney(String(Math.abs(value)), null)}`;
}

/**
 * Цвет разницы. У расходов рост — плохо, у дохода наоборот, поэтому цвет
 * зависит не только от знака.
 */
function diffClass(amount: string, higherIsBetter = false): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) return '';
  const bad = higherIsBetter ? value < 0 : value > 0;
  return bad ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium';
}
