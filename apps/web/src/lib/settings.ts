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

/** Google Contacts Sync (Toggle; Credentials aus Speicher & Cloud). */
export interface ContactsConfig {
  enabled: boolean;
  credentialsConfigured: boolean;
  impersonateEmail: string;
}

/** Google Calendar Sync (Toggle; Credentials aus Speicher & Cloud). */
export interface CalendarConfig {
  enabled: boolean;
  credentialsConfigured: boolean;
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

/**
 * Öffentliche URL zum hellen Firmenlogo für Dark Mode.
 *
 * @param cacheBust - Cache-Buster
 */
export function companyLogoDarkUrl(cacheBust?: string | number): string {
  const base = `${API_BASE_URL}/company/logo-dark/file`;
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

  // KI / Assistent
  getAiConfig: () =>
    apiClient.get<{
      enabled: boolean;
      baseUrl: string;
      model: string;
      timeoutMs: number;
      apiKeyConfigured: boolean;
      apiKeyMasked: string;
    }>('/settings/ai'),
  saveAiConfig: (config: {
    enabled: boolean;
    baseUrl: string;
    model: string;
    apiKey?: string;
    timeoutMs?: number;
  }) =>
    apiFetch<{ saved: boolean }>('/settings/ai', {
      method: 'PUT',
      body: config,
    }),
  testAiConnection: () =>
    apiClient.post<{ success: boolean; error?: string }>('/settings/ai/test'),

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

  // Google Contacts
  getContactsConfig: () =>
    apiClient.get<ContactsConfig>('/settings/contacts'),
  saveContactsConfig: (config: Pick<ContactsConfig, 'enabled'>) =>
    apiFetch<{ saved: boolean }>('/settings/contacts', {
      method: 'PUT',
      body: config,
    }),
  testContactsConnection: () =>
    apiClient.post<{ success: boolean; error?: string }>(
      '/settings/contacts/test',
    ),

  // Google Calendar
  getCalendarConfig: () =>
    apiClient.get<CalendarConfig>('/settings/calendar'),
  saveCalendarConfig: (config: Pick<CalendarConfig, 'enabled'>) =>
    apiFetch<{ saved: boolean }>('/settings/calendar', {
      method: 'PUT',
      body: config,
    }),
  testCalendarConnection: () =>
    apiClient.post<{ success: boolean; error?: string }>(
      '/settings/calendar/test',
    ),

  // Firmeninformationen
  getCompanyInfo: () =>
    apiClient.get<Record<string, unknown>>('/company'),
  saveCompanyInfo: (data: Record<string, unknown>) =>
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
  uploadCompanyLogoDark: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<{ success: true; logoKey: string }>(
      '/company/logo-dark',
      formData,
    );
  },
  getCompanyLogoDarkKey: () =>
    apiClient.get<{ logoKey: string | null }>('/company/logo-dark'),

  // Verrechnung
  getBilling: () => apiClient.get<BillingSettingsResponse>('/settings/billing'),
  saveBilling: (body: UpdateBillingBody) =>
    apiFetch<BillingSettingsResponse>('/settings/billing', {
      method: 'PUT',
      body,
    }),
};

/** Nummernkreis-Vorschau (RE/ST/KO). */
export interface InvoiceSeriesView {
  code: 'OUTGOING' | 'STORNO' | 'CORRECTION';
  prefix: string;
  nextNumber: number;
  preview: string;
}

export interface PerformanceCountry {
  countryCode: string;
  name: string;
  standardRate: number;
  reducedRate: number;
}

export interface BillingSettingsData {
  defaultPaymentTermDays: number;
  paymentTermOptions: number[];
  skonto: {
    percent: number | null;
    days: number | null;
    pdfHintTemplate: string | null;
  };
  performanceCountries: PerformanceCountry[];
  reverseChargePdfText: string;
}

export interface BillingSettingsResponse {
  series: {
    re: InvoiceSeriesView;
    st: InvoiceSeriesView;
    ko: InvoiceSeriesView;
  };
  settings: BillingSettingsData;
}

export interface UpdateBillingBody {
  series?: {
    re?: { prefix?: string; nextNumber?: number };
    st?: { prefix?: string; nextNumber?: number };
    ko?: { prefix?: string; nextNumber?: number };
  };
  settings?: Partial<BillingSettingsData>;
}
