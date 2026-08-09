/**
 * API-Helfer für App-/Firmen-/E-Mail-/Storage-Einstellungen.
 */

import { apiClient, apiFetch, apiUpload } from './api-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

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

/**
 * Öffentliche URL zum Firmenlogo-Stream (auch ohne Login).
 *
 * @param cacheBust - Parameter `cacheBust` (string | number)
 * @returns string
 */
export function companyLogoUrl(cacheBust?: string | number): string {
  const base = `${API_BASE_URL}/company/logo/file`;
  return cacheBust != null ? `${base}?t=${cacheBust}` : base;
}

/** API-Client für System-Einstellungen (E-Mail/SMTP, Speicher/Google Drive). */
export const settingsApi = {
  // E-Mail / SMTP
  getEmailConfig: () =>
    apiClient.get<SmtpConfig & { configured: boolean }>('/settings/email'),
  saveEmailConfig: (config: SmtpConfig) =>
    apiFetch<{ saved: boolean }>('/settings/email', {
      method: 'PUT',
      body: config,
    }),
  sendTestEmail: (to: string) =>
    apiClient.post<{ success: boolean; error?: string }>(
      '/settings/email/test',
      { to },
    ),

  // Storage / Google Drive
  getStorageConfig: () =>
    apiClient.get<StorageConfig>('/settings/storage'),
  saveStorageConfig: (config: StorageConfig) =>
    apiFetch<{ saved: boolean }>('/settings/storage', {
      method: 'PUT',
      body: config,
    }),
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
    return apiUpload<{ success: true; logoKey: string }>(
      '/company/logo',
      formData,
    );
  },
  getCompanyLogoKey: () =>
    apiClient.get<{ logoKey: string | null }>('/company/logo'),
};
