/**
 * API-Client für KI-Assistent-Einstellungen und Kontakt-Import.
 */

import { apiClient, apiFetch, apiUpload } from './api-client';

export interface AiAssistantConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
}

export type ImportMode =
  | 'ONE_CUSTOMER_MANY_CONTACTS'
  | 'ONE_ROW_ONE_CUSTOMER';

export type EnrichmentStatus = 'FOUND' | 'PARTIAL' | 'NOT_FOUND' | 'SKIPPED';

export interface AiImportBranch {
  include: boolean;
  key: string;
  name: string;
  branchType?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  mapsUrl?: string;
  notes?: string;
  enrichmentStatus: EnrichmentStatus;
  sourceUrls?: string[];
}

export interface AiImportContact {
  include: boolean;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phoneLandline?: string;
  phoneMobile?: string;
  linkedInUrl?: string;
  country?: string;
  department?: string;
  branchKey?: string;
  notes?: string;
  priority?: 'A' | 'B' | 'C';
  kind?: 'PERSON' | 'COMPANY_EMAIL';
}

export interface AiImportCompanyEmail {
  include: boolean;
  email: string;
  label?: string;
  emailType?: string;
}

export interface AiImportCustomerDraft {
  companyName: string;
  country?: string;
  website?: string;
  industry?: string;
  rating?: string;
  notes?: string;
}

export interface AiImportPreview {
  previewId: string;
  sourceFilename: string;
  suggestedMode: ImportMode;
  customerDraft?: AiImportCustomerDraft;
  branches: AiImportBranch[];
  contacts: AiImportContact[];
  companyEmails?: AiImportCompanyEmail[];
  warnings: string[];
  existingCustomerMatches?: Array<{
    id: string;
    customerNumber: string;
    companyName: string;
  }>;
}

export interface AiImportCommitResult {
  customerId: string;
  customerNumber: string;
  createdBranches: number;
  createdContacts: number;
  createdEmails: number;
  reusedBranches: number;
  skipped: {
    contacts: number;
    branches: number;
    emails: number;
  };
}

export const aiSettingsApi = {
  get: () => apiClient.get<AiAssistantConfig>('/settings/ai'),
  save: (config: {
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
  test: () =>
    apiClient.post<{ success: boolean; error?: string }>('/settings/ai/test'),
};

export const aiImportApi = {
  preview: async (opts: {
    file: File;
    hint?: string;
    mode?: ImportMode;
    enrichBranches?: boolean;
  }): Promise<AiImportPreview> => {
    const form = new FormData();
    form.append('file', opts.file);
    if (opts.hint?.trim()) form.append('hint', opts.hint.trim());
    if (opts.mode) form.append('mode', opts.mode);
    form.append(
      'enrichBranches',
      opts.enrichBranches === false ? 'false' : 'true',
    );
    return apiUpload<AiImportPreview>('/ai-import/contacts/preview', form);
  },

  commit: (body: {
    previewId?: string;
    mode?: ImportMode;
    suggestedMode?: ImportMode;
    attachToCustomerId?: string;
    sourceFilename?: string;
    customerDraft?: AiImportCustomerDraft;
    branches: AiImportBranch[];
    contacts: AiImportContact[];
    companyEmails?: AiImportCompanyEmail[];
    warnings?: string[];
  }) =>
    apiClient.post<AiImportCommitResult>('/ai-import/contacts/commit', body),
};
