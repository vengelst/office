/**
 * Client für allgemeine Kiosk-/GPS-/PIN-/Arbeitszeit-Alarm-Einstellungen.
 */

import { apiClient } from './api-client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export const DEFAULT_PIN_LENGTH = 6;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 8;
export const DEFAULT_OVERTIME_ALERT_HOURS = 10;
export const MIN_OVERTIME_ALERT_HOURS = 1;
export const MAX_OVERTIME_ALERT_HOURS = 24;
export const DEFAULT_OVERTIME_ALERT_REMINDERS = 1;
export const MIN_OVERTIME_ALERT_REMINDERS = 1;
export const MAX_OVERTIME_ALERT_REMINDERS = 10;
export const DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES = 30;
export const MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES = 5;
export const MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES = 240;

export interface KioskPublicSettings {
  debugLogEnabled: boolean;
  gpsIntervalMinutes: number;
  /** Stempel-/Kiosk-PIN-Länge (4–8). */
  pinLength: number;
}

export interface KioskGeneralSettings extends KioskPublicSettings {
  /** Empfänger für Arbeitszeit-Alarm; leer = deaktiviert. */
  overtimeAlertEmail: string;
  /** Schwelle in Stunden (durchgehend eingestempelt). */
  overtimeAlertHours: number;
  /** Anzahl Alarme inkl. erster Meldung (1–10). */
  overtimeAlertReminders: number;
  /** Minuten zwischen Erinnerungen (5–240). */
  overtimeAlertReminderIntervalMinutes: number;
}

function withPublicDefaults(
  partial: Partial<KioskPublicSettings> | null | undefined,
): KioskPublicSettings {
  const rawLen = partial?.pinLength;
  const pinLength =
    typeof rawLen === 'number' &&
    rawLen >= MIN_PIN_LENGTH &&
    rawLen <= MAX_PIN_LENGTH
      ? rawLen
      : DEFAULT_PIN_LENGTH;
  return {
    debugLogEnabled: Boolean(partial?.debugLogEnabled),
    gpsIntervalMinutes:
      typeof partial?.gpsIntervalMinutes === 'number' &&
      partial.gpsIntervalMinutes >= 1
        ? partial.gpsIntervalMinutes
        : 20,
    pinLength,
  };
}

function clampOvertimeHours(raw: number | undefined): number {
  if (
    typeof raw === 'number' &&
    Number.isFinite(raw) &&
    raw >= MIN_OVERTIME_ALERT_HOURS &&
    raw <= MAX_OVERTIME_ALERT_HOURS
  ) {
    return Math.round(raw);
  }
  return DEFAULT_OVERTIME_ALERT_HOURS;
}

function clampReminders(raw: number | undefined): number {
  if (
    typeof raw === 'number' &&
    Number.isFinite(raw) &&
    raw >= MIN_OVERTIME_ALERT_REMINDERS &&
    raw <= MAX_OVERTIME_ALERT_REMINDERS
  ) {
    return Math.round(raw);
  }
  return DEFAULT_OVERTIME_ALERT_REMINDERS;
}

function clampReminderInterval(raw: number | undefined): number {
  if (
    typeof raw === 'number' &&
    Number.isFinite(raw) &&
    raw >= MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES &&
    raw <= MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES
  ) {
    return Math.round(raw);
  }
  return DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES;
}

function withGeneralDefaults(
  partial: Partial<KioskGeneralSettings> | null | undefined,
): KioskGeneralSettings {
  return {
    ...withPublicDefaults(partial),
    overtimeAlertEmail: (partial?.overtimeAlertEmail ?? '').trim(),
    overtimeAlertHours: clampOvertimeHours(partial?.overtimeAlertHours),
    overtimeAlertReminders: clampReminders(partial?.overtimeAlertReminders),
    overtimeAlertReminderIntervalMinutes: clampReminderInterval(
      partial?.overtimeAlertReminderIntervalMinutes,
    ),
  };
}

export const kioskSettingsApi = {
  /** Öffentlich – Kiosk / Monteur-App (ohne Alarm-Felder). */
  getPublic: async (): Promise<KioskPublicSettings> => {
    try {
      const res = await fetch(`${API_BASE}/kiosk-settings/public`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        return withPublicDefaults(null);
      }
      return withPublicDefaults(
        (await res.json()) as Partial<KioskPublicSettings>,
      );
    } catch {
      return withPublicDefaults(null);
    }
  },
  getGeneral: async (): Promise<KioskGeneralSettings> =>
    withGeneralDefaults(
      await apiClient.get<KioskGeneralSettings>('/kiosk-settings/general'),
    ),
  putGeneral: async (
    body: KioskGeneralSettings,
  ): Promise<KioskGeneralSettings> =>
    withGeneralDefaults(
      await apiClient.put<KioskGeneralSettings>('/kiosk-settings/general', {
        debugLogEnabled: body.debugLogEnabled,
        gpsIntervalMinutes: body.gpsIntervalMinutes,
        pinLength: body.pinLength,
        overtimeAlertEmail: body.overtimeAlertEmail,
        overtimeAlertHours: body.overtimeAlertHours,
        overtimeAlertReminders: body.overtimeAlertReminders,
        overtimeAlertReminderIntervalMinutes:
          body.overtimeAlertReminderIntervalMinutes,
      }),
    ),

  /** Test-Mail für Arbeitszeit-Alarm (ohne Stempeldaten). */
  sendOvertimeAlertTest: async (
    to?: string,
  ): Promise<{ success: boolean; to: string; error?: string }> =>
    apiClient.post<{ success: boolean; to: string; error?: string }>(
      '/kiosk-settings/overtime-alert/test',
      to ? { to } : {},
    ),

  /** Sofort-Prüfung: offene Stempelungen gegen Schwelle, ggf. erneut senden. */
  runOvertimeAlertCheck: async (): Promise<{
    checked: number;
    sent: number;
    to: string;
    alertHours: number;
    reminders: number;
    intervalMinutes: number;
  }> =>
    apiClient.post<{
      checked: number;
      sent: number;
      to: string;
      alertHours: number;
      reminders: number;
      intervalMinutes: number;
    }>('/kiosk-settings/overtime-alert/run', {}),
};
