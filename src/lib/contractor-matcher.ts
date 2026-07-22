import { SupplierRow, TenderMode, TENDER_MODE_LABELS } from './api';

/**
 * Подбор подрядчиков под маршрут запроса.
 *
 * `full`    — подрядчик возит обе страны маршрута и подходит по виду транспорта;
 *             такие отмечаются автоматически.
 * `partial` — покрыта только одна из стран (или направления не заданы, но конфликта нет).
 * `none`    — подрядчик явно возит другое: направления/транспорт заданы и не подходят.
 *
 * Незаполненные данные никогда не дают `none` — иначе подрядчики, которым ещё не
 * проставили направления, молча выпали бы из подбора.
 */
export type MatchType = 'full' | 'partial' | 'none';

export interface MatchedSupplier {
  supplier: SupplierRow;
  score: number;
  matchType: MatchType;
  reasons: string[];
}

export interface MatchParams {
  originCountry?: string;
  destinationCountry?: string;
  mode?: TenderMode;
}

/** Порядок вывода: подходящие → нейтральные → заведомо неподходящие. */
const RANK: Record<MatchType, number> = { full: 0, partial: 1, none: 2 };

/**
 * Страны сравниваем по нормализованному виду: в справочнике они капсом
 * («РОССИЯ»), у подрядчика — как ввёл менеджер («Россия», « россия »).
 */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е');
}

function covers(directions: string[], country?: string): boolean {
  if (!country?.trim() || directions.length === 0) return false;
  const target = norm(country);
  return directions.some((d) => {
    const v = norm(d);
    // Терпим расхождения вида «Россия» ↔ «Российская Федерация».
    return v === target || v.includes(target) || target.includes(v);
  });
}

export function matchSuppliers(params: MatchParams, suppliers: SupplierRow[]): MatchedSupplier[] {
  const { originCountry, destinationCountry, mode } = params;
  const routeKnown = !!(originCountry?.trim() || destinationCountry?.trim());

  return suppliers
    .map((supplier): MatchedSupplier => {
      const reasons: string[] = [];
      let score = 0;

      const hasDirections = supplier.directions.length > 0;
      const coversFrom = covers(supplier.directions, originCountry);
      const coversTo = covers(supplier.directions, destinationCountry);

      const hasModes = supplier.transportModes.length > 0;
      const modeConflict = !!mode && hasModes && !supplier.transportModes.includes(mode);
      const modeOk = !modeConflict;

      if (coversFrom && coversTo) {
        score += 60;
        reasons.push(`Возит ${originCountry} → ${destinationCountry}`);
      } else if (coversFrom || coversTo) {
        score += 25;
        reasons.push(`Возит ${coversFrom ? originCountry : destinationCountry}`);
      }

      if (mode && hasModes && !modeConflict) {
        score += 20;
        reasons.push(TENDER_MODE_LABELS[mode]);
      }

      // Небольшой бонус за надёжность — при прочих равных выше тот, кто отвечает.
      if (supplier.responseRate != null) score += Math.round(supplier.responseRate / 10);

      let matchType: MatchType;
      if (modeConflict) {
        matchType = 'none';
        reasons.length = 0;
        reasons.push('Другой вид транспорта');
      } else if (routeKnown && hasDirections && !coversFrom && !coversTo) {
        matchType = 'none';
        reasons.length = 0;
        reasons.push('Не возит это направление');
      } else if (coversFrom && coversTo && modeOk) {
        matchType = 'full';
      } else if (coversFrom || coversTo) {
        matchType = 'partial';
      } else {
        // Направления не заполнены — подрядчик остаётся доступным вручную.
        matchType = 'partial';
        if (!hasDirections) reasons.push('Направления не заданы');
      }

      return { supplier, score, matchType, reasons };
    })
    // Сначала по типу совпадения, потом по баллам: иначе подрядчик с высоким
    // score, но заведомо неподходящий (`none`), всплывал бы выше нейтральных.
    .sort(
      (a, b) =>
        RANK[a.matchType] - RANK[b.matchType] ||
        b.score - a.score ||
        a.supplier.name.localeCompare(b.supplier.name),
    );
}
