/**
 * Client für allgemeine Kiosk-/GPS-/PIN-Einstellungen.
 */

import { apiClient } from './api-client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export const DEFAULT_PIN_LENGTH = 6;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 8;

export interface KioskGeneralSettings {
  debugLogEnabled: boolean;
  gpsIntervalMinutes: number;
  /** Stempel-/Kiosk-PIN-Länge (4–8). */
  pinLength: number;
}

function withDefaults(
  partial: Partial<KioskGeneralSettings> | null | undefined,
): KioskGeneralSettings {
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

export const kioskSettingsApi = {
  /** Öffentlich – Kiosk / Monteur-App. */
  getPublic: async (): Promise<KioskGeneralSettings> => {
    try {
      const res = await fetch(`${API_BASE}/kiosk-settings/public`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        return withDefaults(null);
      }
      return withDefaults(
        (await res.json()) as Partial<KioskGeneralSettings>,
      );
    } catch {
      return withDefaults(null);
    }
  },
  getGeneral: async (): Promise<KioskGeneralSettings> =>
    withDefaults(await apiClient.get<KioskGeneralSettings>('/kiosk-settings/general')),
  putGeneral: async (
    body: KioskGeneralSettings,
  ): Promise<KioskGeneralSettings> =>
    withDefaults(
      await apiClient.put<KioskGeneralSettings>('/kiosk-settings/general', body),
    ),
};
