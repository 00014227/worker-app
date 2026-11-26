import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  receivablesApi,
  STOP_KIND_LABELS,
  type DebtMailMode,
  type DebtStage,
  type DebtorDeferral,
  type DebtorDocument,
  type DidoxActStatus,
  type DebtorLetter,
  type DebtorRow,
  type DebtorStop,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  LETTER_STATUS,
  MAIL_MODE,
  didoxBadge,
  formatDate,
  formatDateTime,
  formatMoney,
  overdueLabel,
  overdueTone,
  termLabel,
  todayYmd,
} from './receivables-meta';
import { Drawer, Notice, Panel, Pill, SectionTitle } from './receivables-ui';
import { DeferralSection } from './DeferralSection';
import { DidoxLinkSection } from './DidoxLinkSection';
import { StopSection } from './StopSection';

interface DebtorDetails {
  documents: DebtorDocument[];
  letters: DebtorLetter[];
  deferrals: DebtorDeferral[];
  stops: DebtorStop[];
}

/** Почему клиенту ещё не писали и когда напишем — вместо пустого «писем нет». */
function noLettersReason(row: DebtorRow): string {
  if (!row.email)
    return 'Писем не было: у клиента нет email — ни в карточке 1С, ни в «Клиенты».';
  if (row.stops.length)
    return `Писем нет: ${row.stops.map((kind) => STOP_KIND_LABELS[kind].toLowerCase()).join(', ')}.`;
  if (!row.nextLetter) return 'Писем этому клиенту ещё не было.';
  const when =
    row.nextLetter.date === todayYmd()
      ? 'при ближайшем прогоне'
      : formatDate(row.nextLetter.date);
  return `Писем этому клиенту ещё не было. Первое — «${row.nextLetter.title}», ${when}.`;
}

export function DebtorPanel({
  row,
  mode,
  stages,
  canAct,
  onClose,
  onChanged,
}: {
  row: DebtorRow;
  mode: DebtMailMode;
  stages: DebtStage[];
  canAct: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [details, setDetails] = useState<DebtorDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(
    () =>
      receivablesApi
        .details(row.customerId)
        .then(setDetails)
        .catch((loadError: Error) => setError(loadError.message)),
    [row.customerId],
  );
  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleChanged = () => {
    loadDetails();
    onChanged();
  };

  const subtitle = row.email ?? (
    <span className="text-red-700">
      Нет email — укажите почту в карточке клиента в 1С (подтянется утром) или в
      разделе{' '}
      <Link to="/customers" className="underline">
        «Клиенты»
      </Link>
    </span>
  );

  return (
    <Drawer title={row.name} subtitle={subtitle} onClose={onClose}>
      {error && <Notice tone="red">{error}</Notice>}

      {!details ? (
        !error && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Загрузка…
          </div>
        )
      ) : (
        <>
          <StopSection
            customerId={row.customerId}
            stops={details.stops}
            canAct={canAct}
            onChanged={handleChanged}
          />

          <DeferralSection
            customerId={row.customerId}
            deferrals={details.deferrals}
            onChanged={handleChanged}
          />

          <section className="space-y-2.5">
            <SectionTitle>
              Неоплаченные акты · {details.documents.length}
            </SectionTitle>
            {details.documents.map((document) => (
              <ActCard
                key={document.id}
                document={document}
                canAct={canAct}
                onChanged={handleChanged}
              />
            ))}
          </section>

          <section className="space-y-2.5">
            <SectionTitle>История писем</SectionTitle>
            {details.letters.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                {noLettersReason(row)}
              </p>
            )}
            {details.letters.map((letter) => (
              <LetterCard
                key={letter.id}
                letter={letter}
                currentMode={mode}
                stageTitle={
                  stages.find((stage) => stage.stage === letter.stage)?.title ??
                  `Письмо ${letter.stage}`
                }
              />
            ))}
          </section>
        </>
      )}
    </Drawer>
  );
}

/** Статусы Didox, при которых срок не считаем и письмо по акту не шлём. */
const DIDOX_BLOCKING: DidoxActStatus[] = [
  'rejected',
  'not_found',
  'not_sent',
  'unmatched',
  'no_inn',
];

function ActCard({
  document,
  canAct,
  onChanged,
}: {
  document: DebtorDocument;
  canAct: boolean;
  onChanged: () => void;
}) {
  const didox = didoxBadge(document);
  const { dueDate, deadline, daysOverdue } = document;
  // Срока нет из-за Didox (отказ или нет счёта-фактуры) — причину уже объясняет метка выше.
  const isBlockedByDidox =
    dueDate === null &&
    document.didoxStatus !== null &&
    DIDOX_BLOCKING.includes(document.didoxStatus);
  const hasTerm = dueDate !== null && deadline !== null && daysOverdue !== null;

  return (
    <Panel className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">
            {document.docDate
              ? `№ ${document.docNumber} от ${formatDate(document.docDate)}`
              : 'Долг без акта в 1С'}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {[
              document.contractNumber && `договор ${document.contractNumber}`,
              document.organizationName,
              document.stagesDone.length > 0 &&
                `письма: ${document.stagesDone.join(', ')}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold">
            {formatMoney({
              amount: document.balance,
              currency: document.currency,
            })}
          </div>
          {document.paid !== '0.00' && (
            <div className="text-[12px] text-muted-foreground">
              из{' '}
              {formatMoney({
                amount: document.amount,
                currency: document.currency,
              })}
            </div>
          )}
        </div>
      </div>

      {didox && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <Pill tone={didox.tone}>{didox.label}</Pill>
          {didox.hint && <span>{didox.hint}</span>}
          {document.didoxNumber &&
            document.didoxNumber !== document.docNumber && (
              <span>№ в Didox {document.didoxNumber}</span>
            )}
        </div>
      )}

      <DidoxLinkSection
        document={document}
        canAct={canAct}
        onChanged={onChanged}
      />

      {hasTerm ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-[#F4F6FA] px-3 py-2 text-[13px]">
          <span>
            Срок оплаты{' '}
            <span className="font-semibold">{formatDate(deadline)}</span>
          </span>
          <Pill tone={overdueTone(daysOverdue)}>
            {overdueLabel(daysOverdue)}
          </Pill>
          {deadline !== dueDate && (
            <span className="text-blue-800">
              отсрочка; по договору {formatDate(dueDate)}
            </span>
          )}
          <span className="text-[12px] text-muted-foreground">
            {termLabel(document)}
          </span>
        </div>
      ) : (
        !isBlockedByDidox && (
          <div
            className="rounded-[10px] bg-[#F4F6FA] px-3 py-2 text-[13px] text-muted-foreground"
            title="Письмом не отправляется, случай — в ежедневном отчёте."
          >
            Срок неизвестен: в 1С нет акта или срока оплаты — срок не угадываем.
          </div>
        )
      )}
    </Panel>
  );
}

function LetterCard({
  letter,
  currentMode,
  stageTitle,
}: {
  letter: DebtorLetter;
  currentMode: DebtMailMode;
  stageTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const status = LETTER_STATUS[letter.status];

  return (
    <Panel className={cn('space-y-2', letter.caseClosed && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">
            Письмо {letter.stage}. {stageTitle}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {letter.subject}
          </div>
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>

      <div className="text-[12px] text-muted-foreground">
        {formatDateTime(letter.createdAt)} · просрочка {letter.daysOverdue} дн.
        · кому {letter.toAddr}
        {letter.ccAddr && `, копия ${letter.ccAddr}`}
        {letter.replyToAddr && `, ответ клиента — ${letter.replyToAddr}`}
        {letter.mode !== currentMode &&
          ` · ${MAIL_MODE[letter.mode].label.toLowerCase()}`}
      </div>
      {letter.caseClosed && (
        <div className="text-[12px] text-muted-foreground">
          Прошлая просрочка — долг тогда был погашен.
        </div>
      )}
      {letter.error && (
        <div className="text-[13px] text-red-700">{letter.error}</div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
      >
        {isOpen ? <EyeOff size={14} /> : <Eye size={14} />}
        {isOpen ? 'Скрыть текст' : 'Текст письма'}
      </button>

      {isOpen && (
        // sandbox без разрешений: скрипты в письме не выполнятся.
        <iframe
          title={letter.subject}
          sandbox=""
          srcDoc={letter.html}
          className="h-[28rem] w-full rounded-[10px] border border-border bg-white"
        />
      )}
    </Panel>
  );
}
