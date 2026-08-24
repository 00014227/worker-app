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

/** Терпим расхождения вида «Россия» ↔ «Российская Федерация». */
function sideMatches(side: string, target: string): boolean {
  return side === target || side.includes(target) || target.includes(side);
}

function covers(directions: string[], country?: string): boolean {
  if (!country?.trim() || directions.length === 0) return false;
  const target = norm(country);
  return directions.some((d) => sideMatches(norm(d), target));
}

/**
 * У подрядчика есть запись именно про ЭТУ пару стран (в любом порядке).
 *
 * В данных сосуществуют два формата `directions`: пары «Страна A - Страна B»
 * (пришли из бэкапа старой платформы, сохранены дословно по требованию
 * пользователя) и плоский список стран через запятую («Россия, Казахстан,
 * Узбекистан») — единственный формат, который сегодня умеет вводить сам
 * интерфейс (см. поле в ContractorsPage.tsx с подсказкой «Россия, Казахстан,
 * Узбекистан»). Форматы разбираются по-разному:
 *
 *  - Пара «A - B» — это ОДИН явно названный маршрут, сравниваем буквально.
 *  - Плоский список — просто набор стран, с которыми работает подрядчик, без
 *    указания, какие из них сочетаются в один рейс. Совпадение по каждой
 *    стране независимо (как было раньше) на списке из 3+ стран — чистое
 *    гадание: «возит Испанию» и «возит Китай» вместе не значит «возит
 *    Испания → Китай». Подтверждено на боевых данных: пятерым подрядчикам
 *    систем ставила «полное совпадение» на «Узбекистан → Россия», хотя пара
 *    этих стран у них нигде вместе не значилась.
 *    Исключение — когда в плоском списке РОВНО две страны: тогда других
 *    комбинаций просто не существует, и это те самые origin/destination.
 */
function hasExactRoute(directions: string[], origin: string, destination: string): boolean {
  const o = norm(origin);
  const d = norm(destination);

  const flatTokens: string[] = [];
  for (const raw of directions) {
    const parts = raw.split(/\s*[-–—]\s*/).map(norm).filter(Boolean);
    if (parts.length === 2) {
      const [a, b] = parts;
      if ((sideMatches(a, o) && sideMatches(b, d)) || (sideMatches(a, d) && sideMatches(b, o))) {
        return true;
      }
    } else {
      flatTokens.push(norm(raw));
    }
  }

  if (flatTokens.length !== 2) return false;
  return (
    (sideMatches(flatTokens[0], o) && sideMatches(flatTokens[1], d)) ||
    (sideMatches(flatTokens[0], d) && sideMatches(flatTokens[1], o))
  );
}

export function matchSuppliers(params: MatchParams, suppliers: SupplierRow[]): MatchedSupplier[] {
  const { originCountry, destinationCountry, mode } = params;
  const routeKnown = !!(originCountry?.trim() || destinationCountry?.trim());

  return suppliers
    .map((supplier): MatchedSupplier => {
      const reasons: string[] = [];
      let score = 0;

      const hasDirections = supplier.directions.length > 0;
      // Каждая нога маршрута отдельно — только чтобы понять «не возит вообще»
      // (для partial/none) и посчитать очки. За автовыбор она не отвечает.
      const coversFrom = covers(supplier.directions, originCountry);
      const coversTo = covers(supplier.directions, destinationCountry);
      // А вот `full` и автовыбор — только если у подрядчика есть запись именно
      // про ЭТУ пару стран, а не про origin и destination порознь в разных
      // записях. См. hasExactRoute: иначе подрядчик, возящий «Испания —
      // Узбекистан» и отдельно «Китай — Узбекистан», подставлялся бы на
      // маршрут «Испания → Китай», которого у него нет.
      const exactRoute =
        !!originCountry?.trim() &&
        !!destinationCountry?.trim() &&
        hasExactRoute(supplier.directions, originCountry, destinationCountry);

      const hasModes = supplier.transportModes.length > 0;
      const modeConflict = !!mode && hasModes && !supplier.transportModes.includes(mode);
      const modeOk = !modeConflict;

      if (exactRoute) {
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
      } else if (exactRoute && modeOk) {
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
