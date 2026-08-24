/**
 * Client für allgemeine Kiosk-/Office-Einstellungen.
 */

import { apiClient } from './api-client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export interface KioskGeneralSettings {
  debugLogEnabled: boolean;
}

export const kioskSettingsApi = {
  /** Öffentlich – Kiosk vor PIN. */
  getPublic: async (): Promise<KioskGeneralSettings> => {
    const res = await fetch(`${API_BASE}/kiosk-settings/public`, {
      cache: 'no-store',
    });
    if (!res.ok) return { debugLogEnabled: false };
    return res.json() as Promise<KioskGeneralSettings>;
  },
  getGeneral: () =>
    apiClient.get<KioskGeneralSettings>('/kiosk-settings/general'),
  putGeneral: (body: KioskGeneralSettings) =>
    apiClient.put<KioskGeneralSettings>('/kiosk-settings/general', body),
};
