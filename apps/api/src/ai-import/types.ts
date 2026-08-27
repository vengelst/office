/**
 * Gemeinsame Typen für KI-Kontakt-Import (Preview/Commit).
 */

export type ImportMode =
  | 'ONE_CUSTOMER_MANY_CONTACTS'
  | 'ONE_ROW_ONE_CUSTOMER';

export type EnrichmentStatus = 'FOUND' | 'PARTIAL' | 'NOT_FOUND' | 'SKIPPED';

export type ContactKind = 'PERSON' | 'COMPANY_EMAIL';

export type Priority = 'A' | 'B' | 'C';

export interface AiImportBranchDraft {
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

export interface AiImportContactDraft {
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
  priority?: Priority;
  kind?: ContactKind;
}

export interface AiImportCompanyEmailDraft {
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

export interface AiImportPreviewPayload {
  suggestedMode: ImportMode;
  customerDraft?: AiImportCustomerDraft;
  branches: AiImportBranchDraft[];
  contacts: AiImportContactDraft[];
  companyEmails?: AiImportCompanyEmailDraft[];
  warnings: string[];
}

export interface AiImportPreviewResponse extends AiImportPreviewPayload {
  previewId: string;
  sourceFilename: string;
  existingCustomerMatches?: Array<{
    id: string;
    customerNumber: string;
    companyName: string;
  }>;
}

export interface AiImportCommitRequest {
  previewId?: string;
  mode?: ImportMode;
  suggestedMode?: ImportMode;
  attachToCustomerId?: string;
  sourceFilename?: string;
  customerDraft?: AiImportCustomerDraft;
  branches: AiImportBranchDraft[];
  contacts: AiImportContactDraft[];
  companyEmails?: AiImportCompanyEmailDraft[];
  warnings?: string[];
}

export interface AiImportCommitResponse {
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

export interface AiAssistantConfigPublic {
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
}

export interface AiAssistantConfigInternal {
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  apiKey: string;
}
