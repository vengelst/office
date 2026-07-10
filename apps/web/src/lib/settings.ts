import { apiClient, apiFetch } from './api-client';

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

export interface StorageConfig {
  enabled: boolean;
  folderId: string;
  serviceAccountJson: string;
  impersonateEmail: string;
}

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
};
