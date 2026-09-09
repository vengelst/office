/**
 * UNECE Recommendation 20 Unit-Code-Mapping für Rechnungspositionen.
 */

const UNIT_MAP: Record<string, string> = {
  std: 'HUR',
  stunde: 'HUR',
  stunden: 'HUR',
  h: 'HUR',
  hr: 'HUR',
  hour: 'HUR',
  hours: 'HUR',
  stk: 'C62',
  stück: 'C62',
  stueck: 'C62',
  pcs: 'C62',
  pc: 'C62',
  m: 'MTR',
  meter: 'MTR',
  'm²': 'MTK',
  m2: 'MTK',
  qm: 'MTK',
  'm³': 'MTQ',
  m3: 'MTQ',
  kg: 'KGM',
  pauschale: 'LS',
  pauschal: 'LS',
  kw: 'WEE',
  woche: 'WEE',
  wochen: 'WEE',
  tag: 'DAY',
  tage: 'DAY',
  day: 'DAY',
  days: 'DAY',
  set: 'SET',
  paket: 'PK',
};

/**
 * Mappt freie Einheiten-Texte auf UNECE-Codes (Fallback: C62 = piece).
 */
export function mapUnitCode(unit: string | null | undefined): string {
  if (!unit?.trim()) return 'C62';
  const key = unit.trim().toLowerCase();
  return UNIT_MAP[key] ?? 'C62';
}
