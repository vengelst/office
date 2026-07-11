/**
 * Typen und API-Funktionen für die Einstellungsverwaltung.
 * Umfasst SMTP/E-Mail-Konfiguration und Google-Drive-Speicheranbindung.
 */
import { apiClient, apiFetch, apiUpload } from './api-client';

/** SMTP-Konfiguration für den E-Mail-Versand (Server, Zugangsdaten, Absender). */
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  secure: boolean;
  configured?: boolean;
}

/** Konfiguration der Google-Drive-Speicheranbindung (Service-Account + Zielordner). */
export interface StorageConfig {
  enabled: boolean;
  folderId: string;
  serviceAccountJson: string;
  impersonateEmail: string;
}

/** API-Client für System-Einstellungen (E-Mail/SMTP, Speicher/Google Drive). */
export const settingsApi = {
  // E-Mail / SMTP
  /**
   * GET /settings/email – Liest die aktuelle SMTP-Konfiguration.
   * @returns SMTP-Einstellungen inkl. Flag, ob bereits konfiguriert
   */
  getEmailConfig: () =>
    apiClient.get<SmtpConfig & { configured: boolean }>('/settings/email'),
  /**
   * PUT /settings/email – Speichert die SMTP-Konfiguration.
   * @param config - Vollständige SMTP-Einstellungen
   * @returns Bestätigung der Speicherung
   */
  saveEmailConfig: (config: SmtpConfig) =>
    apiFetch<{ saved: boolean }>('/settings/email', {
      method: 'PUT',
      body: config,
    }),
  /**
   * POST /settings/email/test – Sendet eine Test-E-Mail an die angegebene Adresse.
   * @param to - Empfänger-E-Mail-Adresse
   * @returns Erfolg/Fehler-Status des Versands
   */
  sendTestEmail: (to: string) =>
    apiClient.post<{ success: boolean; error?: string }>(
      '/settings/email/test',
      { to },
    ),

  // Storage / Google Drive
  /**
   * GET /settings/storage – Liest die aktuelle Speicher-Konfiguration.
   * @returns Google-Drive-Einstellungen
   */
  getStorageConfig: () =>
    apiClient.get<StorageConfig>('/settings/storage'),
  /**
   * PUT /settings/storage – Speichert die Speicher-Konfiguration.
   * @param config - Vollständige Google-Drive-Einstellungen
   * @returns Bestätigung der Speicherung
   */
  saveStorageConfig: (config: StorageConfig) =>
    apiFetch<{ saved: boolean }>('/settings/storage', {
      method: 'PUT',
      body: config,
    }),
  /**
   * POST /settings/storage/test – Testet die Google-Drive-Verbindung.
   * @returns Erfolg/Fehler-Status der Verbindung
   */
  testStorageConnection: () =>
    apiClient.post<{ success: boolean; error?: string }>(
      '/settings/storage/test',
    ),

  // Firmeninformationen
  getCompanyInfo: () => apiClient.get<Record<string, string>>('/company'),
  saveCompanyInfo: (data: Record<string, string>) =>
    apiClient.post<{ success: true }>('/company', data),
  uploadCompanyLogo: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<{ success: true; logoKey: string }>('/company/logo', formData);
  },
  getCompanyLogoKey: () =>
    apiClient.get<{ logoKey: string | null }>('/company/logo'),
};
