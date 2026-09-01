/**
 * Konstanten für den Arbeitszeit-Überschreitungs-Alarm (durchgehend eingestempelt).
 */

export const OVERTIME_ALERT_EMAIL_KEY = 'overtime_alert_email';
export const OVERTIME_ALERT_HOURS_KEY = 'overtime_alert_hours';
/** Anzahl Alarme pro offener Stempelung (inkl. erster Meldung). */
export const OVERTIME_ALERT_REMINDERS_KEY = 'overtime_alert_reminders';
/** Minuten zwischen zwei Alarmen derselben Stempelung. */
export const OVERTIME_ALERT_REMINDER_INTERVAL_KEY =
  'overtime_alert_reminder_interval_minutes';
/**
 * Intern: JSON-Map timeEntryId → { count, lastSentAt }.
 * Legacy: timeEntryId → ISO-String (wird als count=1 gelesen).
 */
export const OVERTIME_ALERT_SENT_KEY = 'overtime_alert_sent';

/** Default-Schwelle in Stunden (durchgehend seit letztem CLOCK_IN). */
export const DEFAULT_OVERTIME_ALERT_HOURS = 10;
export const MIN_OVERTIME_ALERT_HOURS = 1;
export const MAX_OVERTIME_ALERT_HOURS = 24;

/** Default: 1 Alarm (kein Nachfassen). */
export const DEFAULT_OVERTIME_ALERT_REMINDERS = 1;
export const MIN_OVERTIME_ALERT_REMINDERS = 1;
export const MAX_OVERTIME_ALERT_REMINDERS = 10;

/** Default-Abstand zwischen Erinnerungen. */
export const DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES = 30;
export const MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES = 5;
export const MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES = 240;

export type OvertimeSentState = {
  count: number;
  lastSentAt: string;
};

/** Parst und begrenzt die Alarm-Schwelle; ungültig → Default. */
export function parseOvertimeAlertHours(
  raw: string | null | undefined,
): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(n) &&
    n >= MIN_OVERTIME_ALERT_HOURS &&
    n <= MAX_OVERTIME_ALERT_HOURS
  ) {
    return n;
  }
  return DEFAULT_OVERTIME_ALERT_HOURS;
}

/** Parst Anzahl Erinnerungen (1–10); ungültig → Default. */
export function parseOvertimeAlertReminders(
  raw: string | null | undefined,
): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(n) &&
    n >= MIN_OVERTIME_ALERT_REMINDERS &&
    n <= MAX_OVERTIME_ALERT_REMINDERS
  ) {
    return n;
  }
  return DEFAULT_OVERTIME_ALERT_REMINDERS;
}

/** Parst Minuten-Abstand (5–240); ungültig → Default. */
export function parseOvertimeAlertReminderIntervalMinutes(
  raw: string | null | undefined,
): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(n) &&
    n >= MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES &&
    n <= MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES
  ) {
    return n;
  }
  return DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES;
}

/** Liest einen Dedup-Eintrag (neu oder Legacy-ISO-String). */
export function parseOvertimeSentEntry(
  raw: unknown,
): OvertimeSentState | null {
  if (typeof raw === 'string' && raw.length > 0) {
    return { count: 1, lastSentAt: raw };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const count = typeof obj.count === 'number' ? obj.count : NaN;
  const lastSentAt =
    typeof obj.lastSentAt === 'string' ? obj.lastSentAt : '';
  if (!Number.isFinite(count) || count < 1 || !lastSentAt) return null;
  return { count: Math.floor(count), lastSentAt };
}
