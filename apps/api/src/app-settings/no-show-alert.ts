/**
 * Konstanten für No-Show-Reminder (zugewiesene Monteure ohne CLOCK_IN bis Check-Zeit).
 */

export const NO_SHOW_ALERT_ENABLED_KEY = 'no_show_alert_enabled';
export const NO_SHOW_ALERT_HOUR_KEY = 'no_show_alert_hour';
export const NO_SHOW_ALERT_MINUTE_KEY = 'no_show_alert_minute';
/**
 * Intern: JSON Dedup-State.
 * { cronRunDate?: string, sent?: Record<"workerId|YYYY-MM-DD", true> }
 */
export const NO_SHOW_ALERT_SENT_KEY = 'no_show_alert_sent';

/** Default: ausgeschaltet. */
export const DEFAULT_NO_SHOW_ALERT_ENABLED = false;

/** Default-Check-Zeit Europe/Berlin: 10:00. */
export const DEFAULT_NO_SHOW_ALERT_HOUR = 10;
export const MIN_NO_SHOW_ALERT_HOUR = 0;
export const MAX_NO_SHOW_ALERT_HOUR = 23;

export const DEFAULT_NO_SHOW_ALERT_MINUTE = 0;
export const MIN_NO_SHOW_ALERT_MINUTE = 0;
export const MAX_NO_SHOW_ALERT_MINUTE = 59;

export type NoShowAlertSentState = {
  /** Berlin-Tag (YYYY-MM-DD), an dem der Cron zuletzt gelaufen ist. */
  cronRunDate: string | null;
  /** Bereits gemeldete Worker pro Berlin-Tag: Key `workerId|YYYY-MM-DD`. */
  sent: Record<string, true>;
};

/** Parst Enabled-Flag; ungültig/fehlend → Default false. */
export function parseNoShowAlertEnabled(
  raw: string | null | undefined,
): boolean {
  if (raw == null || raw.trim() === '') return DEFAULT_NO_SHOW_ALERT_ENABLED;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return DEFAULT_NO_SHOW_ALERT_ENABLED;
}

/** Parst Stunde (0–23); ungültig → Default 10. */
export function parseNoShowAlertHour(raw: string | null | undefined): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(n) &&
    n >= MIN_NO_SHOW_ALERT_HOUR &&
    n <= MAX_NO_SHOW_ALERT_HOUR
  ) {
    return n;
  }
  return DEFAULT_NO_SHOW_ALERT_HOUR;
}

/** Parst Minute (0–59); ungültig → Default 0. */
export function parseNoShowAlertMinute(
  raw: string | null | undefined,
): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(n) &&
    n >= MIN_NO_SHOW_ALERT_MINUTE &&
    n <= MAX_NO_SHOW_ALERT_MINUTE
  ) {
    return n;
  }
  return DEFAULT_NO_SHOW_ALERT_MINUTE;
}

/** Dedup-Key für einen Worker an einem Berlin-Tag. */
export function noShowSentKey(workerId: string, dateKey: string): string {
  return `${workerId}|${dateKey}`;
}

/** Parst Dedup-JSON; ungültig → leerer State. */
export function parseNoShowAlertSentState(
  raw: string | null | undefined,
): NoShowAlertSentState {
  if (!raw) return { cronRunDate: null, sent: {} };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { cronRunDate: null, sent: {} };
    }
    const obj = parsed as Record<string, unknown>;
    const cronRunDate =
      typeof obj.cronRunDate === 'string' && obj.cronRunDate.length > 0
        ? obj.cronRunDate
        : null;
    const sent: Record<string, true> = {};
    const rawSent = obj.sent;
    if (rawSent && typeof rawSent === 'object' && !Array.isArray(rawSent)) {
      for (const [k, v] of Object.entries(rawSent as Record<string, unknown>)) {
        if (v === true || v === 1 || v === 'true') sent[k] = true;
      }
    }
    return { cronRunDate, sent };
  } catch {
    return { cronRunDate: null, sent: {} };
  }
}

export function serializeNoShowAlertSentState(
  state: NoShowAlertSentState,
): string {
  return JSON.stringify({
    cronRunDate: state.cronRunDate,
    sent: state.sent,
  });
}
