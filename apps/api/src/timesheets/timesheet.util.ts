/**
 * Hilfsfunktionen für Stundenzettel (Wochengrenzen, Aggregationen, Formatierung).
 */

import { BreakRule } from '@prisma/client';

/**
 * Liefert Montag 00:00 und Sonntag 23:59:59.999 (UTC) einer ISO-Kalenderwoche. ISO-8601: Woche 1 ist die Woche mit dem ersten Donnerstag des Jahres.
 *
 * @param weekYear - Parameter `weekYear` (number)
 * @param weekNumber - Parameter `weekNumber` (number)
 */
export function isoWeekRange(
  weekYear: number,
  weekNumber: number,
): { start: Date; end: Date } {
  // 4. Januar liegt immer in KW1.
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7; // So=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * ISO-Kalenderwoche + zugehöriges Jahr eines Datums.
 *
 * @param date - Parameter `date` (Date)
 */
export function isoWeekOf(date: Date): { weekYear: number; weekNumber: number } {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { weekYear: d.getUTCFullYear(), weekNumber };
}

/**
 * Wählt aus mehreren Regeln die anzuwendende: projektspezifische haben Vorrang vor globalen. Nur aktive Regeln werden berücksichtigt.
 *
 * @param rules - Parameter `rules` (BreakRule[])
 * @param projectId - ID des Projekts (string)
 * @returns BreakRule | null
 */
export function selectBreakRule(
  rules: BreakRule[],
  projectId: string,
): BreakRule | null {
  const active = rules.filter((r) => r.active);
  const projectRule = active.find(
    (r) => r.scopeType === 'PROJECT' && r.projectId === projectId,
  );
  if (projectRule) return projectRule;
  return active.find((r) => r.scopeType === 'GLOBAL') ?? null;
}

/**
 * Berechnet den automatischen Pausenabzug für eine Brutto-Arbeitszeit anhand der gestaffelten Schwellenwerte einer Regel.
 *
 * @param grossMinutes - Parameter `grossMinutes` (number)
 * @param rule - Parameter `rule` (BreakRule | null)
 * @returns number
 */
export function computeBreakMinutes(
  grossMinutes: number,
  rule: BreakRule | null,
): number {
  if (!rule || !rule.autoDeductEnabled) return 0;
  if (
    rule.thresholdMinutes2 != null &&
    rule.breakMinutes2 != null &&
    grossMinutes >= rule.thresholdMinutes2
  ) {
    return rule.breakMinutes2;
  }
  if (grossMinutes >= rule.thresholdMinutes1) {
    return rule.breakMinutes1;
  }
  return 0;
}

/**
 * Differenz in ganzen Minuten (>= 0).
 *
 * @param from - Zeitraum-Beginn (Date)
 * @param to - Zeitraum-Ende (Date)
 * @returns number
 */
export function diffMinutes(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

/**
 * Startdatum eines Tages (lokal) für die Tagesgruppierung.
 *
 * @param date - Parameter `date` (Date)
 * @returns string
 */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}
