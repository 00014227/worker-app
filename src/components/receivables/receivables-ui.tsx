import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_CLASS, type Tone } from './receivables-meta';

/** Кнопки страницы — те же размеры и скругления, что в прототипе CRM. */
export const buttonClass = {
  primary:
    'inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40',
  outline:
    'inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-40',
  link: 'text-[13px] font-medium text-primary hover:underline',
  danger: 'text-[13px] font-medium text-red-700 hover:underline',
};

export function Pill({
  tone,
  title,
  children,
  className,
}: {
  tone: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Сообщение на всю ширину: ошибка, итог прогона, предупреждение. */
export function Notice({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-[12px] px-4 py-2.5 text-[13px] leading-relaxed',
        TONE_CLASS[tone],
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {children}
      </h3>
      {aside}
    </div>
  );
}

/** Панель справа поверх страницы: карточка клиента, праздники. Esc закрывает. */
export function Drawer({
  title,
  subtitle,
  widthClass = 'max-w-2xl',
  onClose,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  widthClass?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex h-full w-full flex-col bg-[#F4F6FA] shadow-2xl',
          widthClass,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border bg-card px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold leading-tight">{title}</h2>
            {subtitle && (
              <div className="mt-1 text-[13px] text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </aside>
    </div>
  );
}

/** Белая карточка-блок: акт, письмо, форма. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-[#E2E6EE] bg-card p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
