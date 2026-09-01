/**
 * Konstanten für den Arbeitszeit-Überschreitungs-Alarm (durchgehend eingestempelt).
 */

export const OVERTIME_ALERT_EMAIL_KEY = 'overtime_alert_email';
export const OVERTIME_ALERT_HOURS_KEY = 'overtime_alert_hours';
/** Intern: JSON-Map timeEntryId → ISO-Zeitstempel der bereits gesendeten Mails. */
export const OVERTIME_ALERT_SENT_KEY = 'overtime_alert_sent';

/** Default-Schwelle in Stunden (durchgehend seit letztem CLOCK_IN). */
export const DEFAULT_OVERTIME_ALERT_HOURS = 10;
export const MIN_OVERTIME_ALERT_HOURS = 1;
export const MAX_OVERTIME_ALERT_HOURS = 24;

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
