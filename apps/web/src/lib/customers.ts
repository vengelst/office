/**
 * Typen und API-Funktionen für das Kundenmodul.
 * Spiegelt die Antworten der NestJS-Customers-/Documents-Endpoints wider.
 */
import { apiClient } from './api-client';

export type CustomerStatus = 'ACTIVE' | 'INACTIVE';
export type CustomerRating = 'A' | 'B' | 'C' | 'D';

export interface CustomerListItem {
  id: string;
  customerNumber: string;
  companyName: string;
  city: string | null;
  industry: string | null;
  rating: string | null;
  status: CustomerStatus;
}

export interface CustomerListResponse {
  data: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerEmail {
  id: string;
  customerId: string;
  email: string;
  emailType: string;
  label: string | null;
  isPrimary: boolean;
}

export interface CustomerBankAccount {
  id: string;
  customerId: string;
  bankName: string;
  iban: string;
  bic: string | null;
  accountHolder: string | null;
  isPrimary: boolean;
  notes: string | null;
}

export interface CustomerBranch {
  id: string;
  customerId: string;
  name: string;
  branchType: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  branchId: string | null;
  title: string | null;
  firstName: string;
  lastName: string;
  role: string | null;
  department: string | null;
  email: string | null;
  phoneMobile: string | null;
  phoneLandline: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  birthday: string | null;
  linkedInUrl: string | null;
  preferredContactMethod: string | null;
  isAccountingContact: boolean;
  isProjectContact: boolean;
  isSignatory: boolean;
  notes: string | null;
}

export interface CustomerDetail {
  id: string;
  customerNumber: string;
  companyName: string;
  legalForm: string | null;
  status: CustomerStatus;
  phone: string | null;
  website: string | null;
  vatId: string | null;
  taxNumber: string | null;
  industry: string | null;
  rating: string | null;
  paymentTermDays: number | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  branches: CustomerBranch[];
  contacts: CustomerContact[];
  emails: CustomerEmail[];
  bankAccounts: CustomerBankAccount[];
}

export interface DocumentItem {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  uploadedBy: { id: string; displayName: string } | null;
  links: { id: string; entityType: string; entityId: string }[];
}

// ── Customers ──────────────────────────────────────────────────

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const customersApi = {
  list(params: ListParams): Promise<CustomerListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<CustomerListResponse>(`/customers?${q.toString()}`);
  },
  get: (id: string) => apiClient.get<CustomerDetail>(`/customers/${id}`),
  create: (body: unknown) => apiClient.post<CustomerDetail>('/customers', body),
  update: (id: string, body: unknown) =>
    apiClient.patch<CustomerDetail>(`/customers/${id}`, body),
  remove: (id: string) => apiClient.delete<unknown>(`/customers/${id}`),

  // Branches
  createBranch: (cid: string, body: unknown) =>
    apiClient.post<CustomerBranch>(`/customers/${cid}/branches`, body),
  updateBranch: (cid: string, id: string, body: unknown) =>
    apiClient.patch<CustomerBranch>(`/customers/${cid}/branches/${id}`, body),
  removeBranch: (cid: string, id: string) =>
    apiClient.delete<unknown>(`/customers/${cid}/branches/${id}`),

  // Contacts
  createContact: (cid: string, body: unknown) =>
    apiClient.post<CustomerContact>(`/customers/${cid}/contacts`, body),
  updateContact: (cid: string, id: string, body: unknown) =>
    apiClient.patch<CustomerContact>(`/customers/${cid}/contacts/${id}`, body),
  removeContact: (cid: string, id: string) =>
    apiClient.delete<unknown>(`/customers/${cid}/contacts/${id}`),

  // Emails
  createEmail: (cid: string, body: unknown) =>
    apiClient.post<CustomerEmail>(`/customers/${cid}/emails`, body),
  updateEmail: (cid: string, id: string, body: unknown) =>
    apiClient.patch<CustomerEmail>(`/customers/${cid}/emails/${id}`, body),
  removeEmail: (cid: string, id: string) =>
    apiClient.delete<unknown>(`/customers/${cid}/emails/${id}`),

  // Bank accounts
  createBankAccount: (cid: string, body: unknown) =>
    apiClient.post<CustomerBankAccount>(`/customers/${cid}/bank-accounts`, body),
  updateBankAccount: (cid: string, id: string, body: unknown) =>
    apiClient.patch<CustomerBankAccount>(
      `/customers/${cid}/bank-accounts/${id}`,
      body,
    ),
  removeBankAccount: (cid: string, id: string) =>
    apiClient.delete<unknown>(`/customers/${cid}/bank-accounts/${id}`),
};

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  mapsUrl: string;
}

export const geocodeApi = {
  lookup: (address: string) =>
    apiClient.get<GeocodeResult>(
      `/geocode?address=${encodeURIComponent(address)}`,
    ),
};

export const documentsApi = {
  listByEntity: (entityType: string, entityId: string) =>
    apiClient.get<DocumentItem[]>(
      `/documents?entityType=${entityType}&entityId=${entityId}`,
    ),
  remove: (id: string) => apiClient.delete<unknown>(`/documents/${id}`),
};
