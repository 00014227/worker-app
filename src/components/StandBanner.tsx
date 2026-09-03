import { AlertTriangle } from 'lucide-react';
import { APP_ENV, IS_PROD_BUILD, buildLabel } from '../lib/env';

const ENV_LABEL: Record<string, string> = {
  staging: 'СТЕНД',
  preview: 'PR-ПРЕВЬЮ',
  development: 'ЛОКАЛЬНО',
};

export function StandBanner() {
  if (IS_PROD_BUILD) return null;

  const label = ENV_LABEL[APP_ENV] ?? APP_ENV.toUpperCase();
  const build = buildLabel();

  return (
    <div className="sticky top-0 z-50 bg-[#ef3f22] text-white px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-medium">
      <AlertTriangle size={12} className="shrink-0" />
      <span className="font-bold tracking-wide">{label}</span>
      {build && <span className="text-white/70">{build}</span>}
      <span className="text-white/90">
        — данные прода: изменения попадают в рабочую базу, отправки уходят
        реальным подрядчикам
      </span>
    </div>
  );
}
