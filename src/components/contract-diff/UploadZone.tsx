import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPT = '.docx,.doc,.pdf,.txt';

/**
 * Зона загрузки одного договора.
 *
 * Принимает и перетаскиванием, и кликом: юристы приходят из Проводника и из
 * почты, и оба пути должны работать. Подпись задаётся снаружи, потому что она
 * меняется вместе с режимом сверки — «Наш шаблон» или «Версия 1».
 */
export default function UploadZone({
  label,
  hint,
  file,
  onPick,
  disabled,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const f = list?.[0];
    if (f) onPick(f);
  };

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) take(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer',
          over
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
          file && 'border-solid border-green-300 bg-green-50/50',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => take(e.target.files)}
        />

        {file ? (
          <div className="flex items-center justify-center gap-2 min-w-0">
            <FileText size={15} className="text-green-700 shrink-0" />
            <span className="text-sm font-medium truncate">{file.name}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {Math.max(1, Math.round(file.size / 1024))} КБ
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPick(null);
              }}
              title="Убрать файл"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="text-muted-foreground">
            <Upload size={18} className="mx-auto mb-1.5" />
            <div className="text-sm">Перетащите файл или нажмите</div>
            <div className="text-[11px] mt-0.5">
              docx или PDF с текстовым слоем
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
