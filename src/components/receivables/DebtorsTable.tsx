import { Ban, CalendarClock, HandCoins, MailX } from 'lucide-react';
import {
  DEFERRAL_REASON_LABELS,
  STOP_KIND_LABELS,
  type DebtorRow,
} from '@/lib/api';
import {
  LETTER_STATUS,
  formatDateTime,
  formatMoney,
  formatMoneyList,
  formatShortDate,
  overdueTone,
} from './receivables-meta';
import { Pill } from './receivables-ui';

export function DebtorsTable({
  rows,
  emptyText,
  onOpen,
}: {
  rows: DebtorRow[];
  emptyText: string;
  onOpen: (row: DebtorRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-[#E2E6EE] bg-card px-6 py-16 text-center text-[14px] text-muted-foreground">
        <HandCoins size={28} className="mx-auto mb-2 opacity-30" />
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-[#E2E6EE] bg-card">
      <table className="w-full min-w-[760px] border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th
              scope="col"
              className="border-b border-[#E2E6EE] px-4 py-2.5 font-semibold"
            >
              Клиент
            </th>
            <th
              scope="col"
              className="border-b border-[#E2E6EE] px-4 py-2.5 text-right font-semibold"
            >
              Просрочено
            </th>
            <th
              scope="col"
              className="border-b border-[#E2E6EE] px-4 py-2.5 text-center font-semibold"
            >
              Дней
            </th>
            <th
              scope="col"
              className="border-b border-[#E2E6EE] px-4 py-2.5 font-semibold"
            >
              Этап
            </th>
            <th
              scope="col"
              className="border-b border-[#E2E6EE] px-4 py-2.5 font-semibold"
            >
              Последнее письмо
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <DebtorTableRow key={row.customerId} row={row} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DebtorTableRow({
  row,
  onOpen,
}: {
  row: DebtorRow;
  onOpen: (row: DebtorRow) => void;
}) {
  const hasBadges = !row.email || row.stops.length > 0 || row.deferral;
  return (
    <tr
      className="cursor-pointer align-top transition-colors hover:bg-[#F7F9FC]"
      onClick={() => onOpen(row)}
    >
      <td className="border-b border-[#EEF1F6] px-4 py-3">
        {/* Кнопка — чтобы карточку можно было открыть и с клавиатуры. */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(row);
          }}
          className="text-left font-semibold text-foreground hover:text-primary hover:underline"
        >
          {row.name}
        </button>
        <div className="mt-0.5 text-[12px] text-muted-foreground">
          {[row.inn && `ИНН ${row.inn}`, ...row.organizations]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {hasBadges && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {!row.email && (
              <Pill tone="red" title="Письма не уходят, пока нет адреса">
                <MailX size={12} /> нет email
              </Pill>
            )}
            {row.stops.map((kind) => (
              <Pill key={kind} tone="red" title="Автоматических писем нет">
                <Ban size={12} /> {STOP_KIND_LABELS[kind].toLowerCase()}
              </Pill>
            ))}
            {row.deferral && (
              <Pill
                tone="blue"
                title={DEFERRAL_REASON_LABELS[row.deferral.reason]}
              >
                <CalendarClock size={12} /> отсрочка до{' '}
                {formatShortDate(row.deferral.until)}
              </Pill>
            )}
          </div>
        )}
      </td>

      <td className="whitespace-nowrap border-b border-[#EEF1F6] px-4 py-3 text-right">
        {row.overdue.length ? (
          row.overdue.map((money) => (
            <div key={money.currency} className="font-semibold">
              {formatMoney(money)}
            </div>
          ))
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        <div className="mt-0.5 text-[12px] text-muted-foreground">
          долг {formatMoneyList(row.debt)}
        </div>
        {row.undated.length > 0 && (
          <div
            className="text-[12px] text-muted-foreground"
            title="В 1С нет акта или срока оплаты: срок не угадываем, письмом не отправляется"
          >
            без срока {formatMoneyList(row.undated)}
          </div>
        )}
      </td>

      <td className="border-b border-[#EEF1F6] px-4 py-3 text-center">
        {row.daysOverdue === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Pill tone={overdueTone(row.daysOverdue)}>{row.daysOverdue}</Pill>
        )}
      </td>

      <td className="border-b border-[#EEF1F6] px-4 py-3 text-[13px]">
        {row.stage ? (
          <span className="font-medium">
            {row.stage.stage}. {row.stage.title}
          </span>
        ) : (
          <span className="text-muted-foreground">писем ещё не было</span>
        )}
        {row.nextLetter && (
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            далее письмо {row.nextLetter.stage},{' '}
            {formatShortDate(row.nextLetter.date)}
          </div>
        )}
      </td>

      <td className="border-b border-[#EEF1F6] px-4 py-3 text-[13px]">
        {row.lastLetter ? (
          <>
            <Pill tone={LETTER_STATUS[row.lastLetter.status].tone}>
              Письмо {row.lastLetter.stage} ·{' '}
              {LETTER_STATUS[row.lastLetter.status].label}
            </Pill>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {formatDateTime(row.lastLetter.createdAt)}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
