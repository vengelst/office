/**
 * Client für allgemeine Kiosk-/GPS-Einstellungen.
 */

import { apiClient } from './api-client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export interface KioskGeneralSettings {
  debugLogEnabled: boolean;
  gpsIntervalMinutes: number;
}

export const kioskSettingsApi = {
  /** Öffentlich – Kiosk / Monteur-App. */
  getPublic: async (): Promise<KioskGeneralSettings> => {
    try {
      const res = await fetch(`${API_BASE}/kiosk-settings/public`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        return { debugLogEnabled: false, gpsIntervalMinutes: 20 };
      }
      return res.json() as Promise<KioskGeneralSettings>;
    } catch {
      return { debugLogEnabled: false, gpsIntervalMinutes: 20 };
    }
  },
  getGeneral: () =>
    apiClient.get<KioskGeneralSettings>('/kiosk-settings/general'),
  putGeneral: (body: KioskGeneralSettings) =>
    apiClient.put<KioskGeneralSettings>('/kiosk-settings/general', body),
};
