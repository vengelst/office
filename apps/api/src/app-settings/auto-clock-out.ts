/**
 * Konstanten für Auto-Clock-Out (systemseitiges Ausstempeln nach Maximaldauer).
 */

export const AUTO_CLOCK_OUT_ENABLED_KEY = 'auto_clock_out_enabled';
export const AUTO_CLOCK_OUT_HOURS_KEY = 'auto_clock_out_hours';

/** sourceDevice-Wert für systemseitige Ausstempelungen. */
export const SYSTEM_AUTO_CLOCK_OUT_DEVICE = 'SYSTEM_AUTO_CLOCK_OUT';

/** Default: ausgeschaltet. */
export const DEFAULT_AUTO_CLOCK_OUT_ENABLED = false;

/** Default-Schwelle in Stunden (durchgehend seit letztem CLOCK_IN). */
export const DEFAULT_AUTO_CLOCK_OUT_HOURS = 12;
export const MIN_AUTO_CLOCK_OUT_HOURS = 1;
export const MAX_AUTO_CLOCK_OUT_HOURS = 24;

/** Parst Enabled-Flag; ungültig/fehlend → Default false. */
export function parseAutoClockOutEnabled(
  raw: string | null | undefined,
): boolean {
  if (raw == null || raw.trim() === '') return DEFAULT_AUTO_CLOCK_OUT_ENABLED;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return DEFAULT_AUTO_CLOCK_OUT_ENABLED;
}

/** Parst und begrenzt die Auto-Out-Schwelle; ungültig → Default 12. */
export function parseAutoClockOutHours(
  raw: string | null | undefined,
): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(n) &&
    n >= MIN_AUTO_CLOCK_OUT_HOURS &&
    n <= MAX_AUTO_CLOCK_OUT_HOURS
  ) {
    return n;
  }
  return DEFAULT_AUTO_CLOCK_OUT_HOURS;
}

/** Fester DE-Kommentar für System-Ausstempelungen. */
export function autoClockOutComment(hours: number): string {
  return `Automatisch ausgestempelt nach ${hours} Stunden (System Auto-Clock-Out)`;
}
