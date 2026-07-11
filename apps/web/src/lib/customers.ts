/**
 * Typen und API-Funktionen für das Kundenmodul.
 * Spiegelt die Antworten der NestJS-Customers-/Documents-Endpoints wider.
 */
import { apiClient } from './api-client';

/** Aktiv-/Inaktiv-Status eines Kunden. */
export type CustomerStatus = 'ACTIVE' | 'INACTIVE';

/** Kundenbewertung (A = beste, D = schlechteste). */
export type CustomerRating = 'A' | 'B' | 'C' | 'D';

/** Kompakte Darstellung eines Kunden für Listenansichten. */
export interface CustomerListItem {
  id: string;
  customerNumber: string;
  companyName: string;
  city: string | null;
  industry: string | null;
  rating: string | null;
  status: CustomerStatus;
}

/** Paginierte Antwort der Kundenliste (inkl. Gesamt-Seitenzahl). */
export interface CustomerListResponse {
  data: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** E-Mail-Adresse eines Kunden (kann primär oder sekundär sein). */
export interface CustomerEmail {
  id: string;
  customerId: string;
  email: string;
  emailType: string;
  label: string | null;
  isPrimary: boolean;
}

/** Bankverbindung eines Kunden (IBAN, BIC, Kontoinhaber). */
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

/** Filiale/Standort eines Kunden inkl. Geodaten und Kontaktinfo. */
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

/** Ansprechpartner eines Kunden (Rolle, Erreichbarkeit, Flags). */
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
  syncToGoogle: boolean;
}

/** Vollständiger Kundendatensatz mit allen Relationen (Filialen, Kontakte, E-Mails, Bankkonten). */
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

/** Dokument-Eintrag im Kundenkontext (Listenansicht mit Upload-Info und Verknüpfungen). */
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

/** Paginierungs- und Sortierparameter für Listenabfragen. */
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** API-Client für Kundenverwaltung (CRUD, Filialen, Kontakte, E-Mails, Bankkonten). */
export const customersApi = {
  /**
   * GET /customers – Listet Kunden paginiert und optional gefiltert/sortiert.
   * @param params - Paginierung, Suchbegriff und Sortierung
   * @returns Paginierte Kundenliste
   */
  list(params: ListParams): Promise<CustomerListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<CustomerListResponse>(`/customers?${q.toString()}`);
  },
  /**
   * GET /customers/:id – Lädt einen einzelnen Kunden mit allen Relationen.
   * @param id - Kunden-ID
   */
  get: (id: string) => apiClient.get<CustomerDetail>(`/customers/${id}`),
  /**
   * POST /customers – Erstellt einen neuen Kunden.
   * @param body - Kundendaten
   */
  create: (body: unknown) => apiClient.post<CustomerDetail>('/customers', body),
  /**
   * PATCH /customers/:id – Aktualisiert einen bestehenden Kunden.
   * @param id - Kunden-ID
   * @param body - Zu aktualisierende Felder
   */
  update: (id: string, body: unknown) =>
    apiClient.patch<CustomerDetail>(`/customers/${id}`, body),
  /**
   * DELETE /customers/:id – Löscht einen Kunden.
   * @param id - Kunden-ID
   */
  remove: (id: string) => apiClient.delete<unknown>(`/customers/${id}`),

  // Branches
  /**
   * POST /customers/:cid/branches – Erstellt eine neue Filiale.
   * @param cid - Kunden-ID
   * @param body - Filialdaten
   */
  createBranch: (cid: string, body: unknown) =>
    apiClient.post<CustomerBranch>(`/customers/${cid}/branches`, body),
  /**
   * PATCH /customers/:cid/branches/:id – Aktualisiert eine Filiale.
   * @param cid - Kunden-ID
   * @param id - Filial-ID
   * @param body - Zu aktualisierende Felder
   */
  updateBranch: (cid: string, id: string, body: unknown) =>
    apiClient.patch<CustomerBranch>(`/customers/${cid}/branches/${id}`, body),
  /**
   * DELETE /customers/:cid/branches/:id – Löscht eine Filiale.
   * @param cid - Kunden-ID
   * @param id - Filial-ID
   */
  removeBranch: (cid: string, id: string) =>
    apiClient.delete<unknown>(`/customers/${cid}/branches/${id}`),

  // Contacts
  /**
   * POST /customers/:cid/contacts – Erstellt einen neuen Ansprechpartner.
   * @param cid - Kunden-ID
   * @param body - Kontaktdaten
   */
  createContact: (cid: string, body: unknown) =>
    apiClient.post<CustomerContact>(`/customers/${cid}/contacts`, body),
  /**
   * PATCH /customers/:cid/contacts/:id – Aktualisiert einen Ansprechpartner.
   * @param cid - Kunden-ID
   * @param id - Kontakt-ID
   * @param body - Zu aktualisierende Felder
   */
  updateContact: (cid: string, id: string, body: unknown) =>
    apiClient.patch<CustomerContact>(`/customers/${cid}/contacts/${id}`, body),
  /**
   * DELETE /customers/:cid/contacts/:id – Löscht einen Ansprechpartner.
   * @param cid - Kunden-ID
   * @param id - Kontakt-ID
   */
  removeContact: (cid: string, id: string) =>
    apiClient.delete<unknown>(`/customers/${cid}/contacts/${id}`),

  // Emails
  /**
   * POST /customers/:cid/emails – Erstellt eine neue E-Mail-Adresse.
   * @param cid - Kunden-ID
   * @param body - E-Mail-Daten (Adresse, Typ, Label)
   */
  createEmail: (cid: string, body: unknown) =>
    apiClient.post<CustomerEmail>(`/customers/${cid}/emails`, body),
  /**
   * PATCH /customers/:cid/emails/:id – Aktualisiert eine E-Mail-Adresse.
   * @param cid - Kunden-ID
   * @param id - E-Mail-ID
   * @param body - Zu aktualisierende Felder
   */
  updateEmail: (cid: string, id: string, body: unknown) =>
    apiClient.patch<CustomerEmail>(`/customers/${cid}/emails/${id}`, body),
  /**
   * DELETE /customers/:cid/emails/:id – Löscht eine E-Mail-Adresse.
   * @param cid - Kunden-ID
   * @param id - E-Mail-ID
   */
  removeEmail: (cid: string, id: string) =>
    apiClient.delete<unknown>(`/customers/${cid}/emails/${id}`),

  // Bank accounts
  /**
   * POST /customers/:cid/bank-accounts – Erstellt eine neue Bankverbindung.
   * @param cid - Kunden-ID
   * @param body - Bankdaten (IBAN, BIC, etc.)
   */
  createBankAccount: (cid: string, body: unknown) =>
    apiClient.post<CustomerBankAccount>(`/customers/${cid}/bank-accounts`, body),
  /**
   * PATCH /customers/:cid/bank-accounts/:id – Aktualisiert eine Bankverbindung.
   * @param cid - Kunden-ID
   * @param id - Bankkonto-ID
   * @param body - Zu aktualisierende Felder
   */
  updateBankAccount: (cid: string, id: string, body: unknown) =>
    apiClient.patch<CustomerBankAccount>(
      `/customers/${cid}/bank-accounts/${id}`,
      body,
    ),
  /**
   * DELETE /customers/:cid/bank-accounts/:id – Löscht eine Bankverbindung.
   * @param cid - Kunden-ID
   * @param id - Bankkonto-ID
   */
  removeBankAccount: (cid: string, id: string) =>
    apiClient.delete<unknown>(`/customers/${cid}/bank-accounts/${id}`),
};

/** Ergebnis einer Adress-Geokodierung (Koordinaten + Maps-Link). */
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  mapsUrl: string;
}

/** API-Client für Adress-Geokodierung via Backend-Proxy. */
export const geocodeApi = {
  /**
   * GET /geocode – Wandelt eine Freitext-Adresse in Koordinaten um.
   * @param address - Adresse als Freitext (z. B. "Musterstraße 1, 10115 Berlin")
   * @returns Breitengrad, Längengrad und Google-Maps-URL
   */
  lookup: (address: string) =>
    apiClient.get<GeocodeResult>(
      `/geocode?address=${encodeURIComponent(address)}`,
    ),
};

/** API-Client für kundenbezogene Dokumentenabfragen (vereinfachte Variante). */
export const documentsApi = {
  /**
   * GET /documents – Listet Dokumente einer bestimmten Entität.
   * @param entityType - Entitätstyp (z. B. "CUSTOMER", "PROJECT")
   * @param entityId - ID der Entität
   * @returns Liste der verknüpften Dokumente
   */
  listByEntity: (entityType: string, entityId: string) =>
    apiClient.get<DocumentItem[]>(
      `/documents?entityType=${entityType}&entityId=${entityId}`,
    ),
  /**
   * DELETE /documents/:id – Löscht ein Dokument.
   * @param id - Dokument-ID
   */
  remove: (id: string) => apiClient.delete<unknown>(`/documents/${id}`),
};
