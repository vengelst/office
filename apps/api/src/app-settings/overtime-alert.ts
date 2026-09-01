/**
 * Konstanten für den Arbeitszeit-Überschreitungs-Alarm (durchgehend eingestempelt).
 */

export const OVERTIME_ALERT_EMAIL_KEY = 'overtime_alert_email';
/** Intern: JSON-Map timeEntryId → ISO-Zeitstempel der bereits gesendeten Mails. */
export const OVERTIME_ALERT_SENT_KEY = 'overtime_alert_sent';
/** Schwelle in Stunden (durchgehend seit letztem CLOCK_IN). */
export const OVERTIME_ALERT_HOURS = 10;
