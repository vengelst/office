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

export interface KioskPublicSettings {
  debugLogEnabled: boolean;
  gpsIntervalMinutes: number;
  /** Stempel-/Kiosk-PIN-Länge (4–8). */
  pinLength: number;
}

export interface KioskGeneralSettings extends KioskPublicSettings {
  /** Empfänger für >10h-Alarm; leer = deaktiviert. */
  overtimeAlertEmail: string;
  overtimeAlertHours: number;
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

function withGeneralDefaults(
  partial: Partial<KioskGeneralSettings> | null | undefined,
): KioskGeneralSettings {
  return {
    ...withPublicDefaults(partial),
    overtimeAlertEmail: (partial?.overtimeAlertEmail ?? '').trim(),
    overtimeAlertHours:
      typeof partial?.overtimeAlertHours === 'number' &&
      partial.overtimeAlertHours >= 1
        ? partial.overtimeAlertHours
        : DEFAULT_OVERTIME_ALERT_HOURS,
  };
}

export const kioskSettingsApi = {
  /** Öffentlich – Kiosk / Monteur-App (ohne Alarm-E-Mail). */
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
    body: Omit<KioskGeneralSettings, 'overtimeAlertHours'> & {
      overtimeAlertHours?: number;
    },
  ): Promise<KioskGeneralSettings> =>
    withGeneralDefaults(
      await apiClient.put<KioskGeneralSettings>('/kiosk-settings/general', {
        debugLogEnabled: body.debugLogEnabled,
        gpsIntervalMinutes: body.gpsIntervalMinutes,
        pinLength: body.pinLength,
        overtimeAlertEmail: body.overtimeAlertEmail,
      }),
    ),
};
