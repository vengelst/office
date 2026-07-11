/**
 * Typen und API-Funktionen für das Abrechnungsmodul (Aus-/Eingangsrechnungen).
 * Spiegelt die Antworten der NestJS-Invoices-Endpoints wider.
 */
import { ApiError, apiClient } from './api-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

// ── Enums (spiegeln Prisma) ────────────────────────────────────

/** Rechnungsrichtung: Ausgangsrechnung an Kunde oder Eingangsrechnung von Subunternehmer. */
export type InvoiceType = 'OUTGOING' | 'INCOMING';

/** Lebenszyklus-Status einer Rechnung (Entwurf → Versendet → Bezahlt/Storniert). */
export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELLED';

/** Art einer Rechnungsposition (Wochenpaket, Überstunden, Abschlag, etc.). */
export type InvoiceLineType =
  | 'WEEKLY_PACKAGE'
  | 'OVERTIME'
  | 'UNIT_BASED'
  | 'PARTIAL_PAYMENT'
  | 'CUSTOM';

// ── Sub-Entities ───────────────────────────────────────────────

/** Einzelne Rechnungsposition mit Menge, Einzelpreis und Gesamtbetrag. */
export interface InvoiceLine {
  id: string;
  invoiceId: string;
  lineType: InvoiceLineType;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  weeklyTimesheetId: string | null;
}

/** Zahlungseingang zu einer Rechnung (Betrag, Datum, Methode). */
export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paidDate: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

// ── Liste ──────────────────────────────────────────────────────

/** Kompakte Darstellung einer Rechnung für Listenansichten (inkl. Projekt/Kunde/Sub). */
export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  periodFrom: string | null;
  periodTo: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount: number | null;
  isPartialInvoice: boolean;
  partialNumber: number | null;
  partialPercentage: number | null;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
  createdAt: string;
  project: { id: string; projectNumber: string; title: string } | null;
  customer: { id: string; companyName: string } | null;
  subcontractor: { id: string; name: string } | null;
  _count: { lines: number; payments: number };
}

/** Paginierte Antwort der Rechnungsliste. */
export interface InvoiceListResponse {
  data: InvoiceListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Detail ─────────────────────────────────────────────────────

/** Vollständiger Rechnungsdatensatz inkl. Positionen, Zahlungen und verknüpftem Projekt/Kunde. */
export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  projectId: string | null;
  customerId: string | null;
  subcontractorId: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  isPartialInvoice: boolean;
  partialNumber: number | null;
  partialPercentage: number | null;
  paymentTermDays: number | null;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
  paidAmount: number | null;
  notes: string | null;
  internalNotes: string | null;
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  project: {
    id: string;
    projectNumber: string;
    title: string;
    billingMode: string | null;
    weeklyPackageHours: number | null;
    weeklyPackagePrice: number | null;
    overtimeRatePerHour: number | null;
  } | null;
  customer: {
    id: string;
    customerNumber: string;
    companyName: string;
    paymentTermDays: number | null;
  } | null;
  subcontractor: { id: string; name: string } | null;
  createdBy: { id: string; displayName: string } | null;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
}

// ── Statistik (Dashboard) ──────────────────────────────────────

/** Zusammenfassung offener und überfälliger Rechnungen (Anzahl + Betrag). */
export interface InvoiceStatsBucket {
  openCount: number;
  openAmount: number;
  overdueCount: number;
  overdueAmount: number;
}

/** Dashboard-Statistiken für Ein- und Ausgangsrechnungen inkl. Monatsumsatz. */
export interface InvoiceStats {
  outgoing: InvoiceStatsBucket;
  incoming: InvoiceStatsBucket;
  revenue: { month: number; year: number };
}

// ── Query-Parameter & Bodies ───────────────────────────────────

/** Filter-, Paginierungs- und Sortierparameter für die Rechnungsliste. */
export interface InvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  projectId?: string;
  customerId?: string;
  subcontractorId?: string;
  periodFrom?: string;
  periodTo?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Request-Body zum Anlegen einer einzelnen Rechnungsposition. */
export interface CreateInvoiceLineBody {
  lineType: InvoiceLineType;
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  position?: number;
  weeklyTimesheetId?: string;
}

/** Request-Body zum Anlegen einer neuen Rechnung (inkl. optionaler Positionen). */
export interface CreateInvoiceBody {
  invoiceType: InvoiceType;
  projectId?: string;
  customerId?: string;
  subcontractorId?: string;
  periodFrom?: string;
  periodTo?: string;
  taxRate?: number;
  isPartialInvoice?: boolean;
  partialNumber?: number;
  partialPercentage?: number;
  paymentTermDays?: number;
  issueDate?: string;
  notes?: string;
  internalNotes?: string;
  lines?: CreateInvoiceLineBody[];
}

/** Request-Body zum Aktualisieren einer Rechnung (ohne Typ- und Positionsänderung). */
export type UpdateInvoiceBody = Partial<Omit<CreateInvoiceBody, 'invoiceType' | 'lines'>>;

/** Request-Body für die automatische Rechnungsgenerierung aus Stundenzetteln. */
export interface GenerateInvoiceBody {
  projectId: string;
  periodFrom: string;
  periodTo: string;
  invoiceType: InvoiceType;
  subcontractorId?: string;
  taxRate?: number;
}

/** Request-Body zum Erfassen einer Zahlung. */
export interface CreatePaymentBody {
  amount: number;
  paidDate: string;
  method?: string;
  reference?: string;
  notes?: string;
}

// ── API ────────────────────────────────────────────────────────

/** API-Client für Rechnungsverwaltung (CRUD, Positionen, Zahlungen, PDF, Workflow). */
export const invoicesApi = {
  /**
   * GET /invoices – Listet Rechnungen paginiert mit optionalen Filtern.
   * @param params - Filter (Typ, Status, Projekt, Kunde, Zeitraum) + Paginierung
   * @returns Paginierte Rechnungsliste
   */
  list(params: InvoiceListParams): Promise<InvoiceListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.type) q.set('type', params.type);
    if (params.status) q.set('status', params.status);
    if (params.projectId) q.set('projectId', params.projectId);
    if (params.customerId) q.set('customerId', params.customerId);
    if (params.subcontractorId) q.set('subcontractorId', params.subcontractorId);
    if (params.periodFrom) q.set('periodFrom', params.periodFrom);
    if (params.periodTo) q.set('periodTo', params.periodTo);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<InvoiceListResponse>(`/invoices?${q.toString()}`);
  },
  /**
   * GET /invoices/:id – Lädt eine einzelne Rechnung inkl. Positionen und Zahlungen.
   * @param id - Rechnungs-ID
   * @returns Rechnungsdetail mit allen Relationen
   */
  get: (id: string) => apiClient.get<InvoiceDetail>(`/invoices/${id}`),
  /**
   * POST /invoices – Erstellt eine neue Rechnung.
   * @param body - Rechnungsdaten inkl. optionaler Positionen
   */
  create: (body: CreateInvoiceBody) =>
    apiClient.post<InvoiceDetail>('/invoices', body),
  /**
   * PATCH /invoices/:id – Aktualisiert eine bestehende Rechnung.
   * @param id - Rechnungs-ID
   * @param body - Zu aktualisierende Felder
   */
  update: (id: string, body: UpdateInvoiceBody) =>
    apiClient.patch<InvoiceDetail>(`/invoices/${id}`, body),
  /**
   * DELETE /invoices/:id – Löscht eine Rechnung (nur im Entwurfs-Status möglich).
   * @param id - Rechnungs-ID
   */
  remove: (id: string) => apiClient.delete<unknown>(`/invoices/${id}`),
  /**
   * POST /invoices/generate-from-timesheets – Generiert eine Rechnung automatisch aus Stundenzetteln.
   * @param body - Projekt, Zeitraum und Rechnungstyp
   */
  generate: (body: GenerateInvoiceBody) =>
    apiClient.post<InvoiceDetail>('/invoices/generate-from-timesheets', body),
  /**
   * POST /invoices/:id/send – Markiert die Rechnung als versendet.
   * @param id - Rechnungs-ID
   */
  send: (id: string) => apiClient.post<InvoiceDetail>(`/invoices/${id}/send`),
  /**
   * POST /invoices/:id/cancel – Storniert eine Rechnung.
   * @param id - Rechnungs-ID
   */
  cancel: (id: string) =>
    apiClient.post<InvoiceDetail>(`/invoices/${id}/cancel`),
  /**
   * POST /invoices/:id/duplicate – Erstellt eine Kopie der Rechnung als neuen Entwurf.
   * @param id - Rechnungs-ID des Originals
   */
  duplicate: (id: string) =>
    apiClient.post<InvoiceDetail>(`/invoices/${id}/duplicate`),
  /**
   * GET /invoices/stats – Lädt Dashboard-Statistiken (offene/überfällige Beträge).
   * @returns Zusammenfassung für Ein- und Ausgangsrechnungen
   */
  stats: () => apiClient.get<InvoiceStats>('/invoices/stats'),

  // Positionen
  /**
   * POST /invoices/:id/lines – Fügt eine neue Position hinzu.
   * @param id - Rechnungs-ID
   * @param body - Positionsdaten
   */
  addLine: (id: string, body: CreateInvoiceLineBody) =>
    apiClient.post<InvoiceLine>(`/invoices/${id}/lines`, body),
  /**
   * PATCH /invoices/:id/lines/:lineId – Aktualisiert eine Position.
   * @param id - Rechnungs-ID
   * @param lineId - Positions-ID
   * @param body - Zu aktualisierende Felder
   */
  updateLine: (id: string, lineId: string, body: Partial<CreateInvoiceLineBody>) =>
    apiClient.patch<InvoiceLine>(`/invoices/${id}/lines/${lineId}`, body),
  /**
   * DELETE /invoices/:id/lines/:lineId – Löscht eine Position.
   * @param id - Rechnungs-ID
   * @param lineId - Positions-ID
   */
  removeLine: (id: string, lineId: string) =>
    apiClient.delete<unknown>(`/invoices/${id}/lines/${lineId}`),
  /**
   * POST /invoices/:id/lines/reorder – Sortiert Positionen in neuer Reihenfolge.
   * @param id - Rechnungs-ID
   * @param lineIds - Positions-IDs in gewünschter Reihenfolge
   */
  reorderLines: (id: string, lineIds: string[]) =>
    apiClient.post<InvoiceLine[]>(`/invoices/${id}/lines/reorder`, { lineIds }),

  // Zahlungen
  /**
   * POST /invoices/:id/payments – Erfasst eine Zahlung.
   * @param id - Rechnungs-ID
   * @param body - Zahlungsdaten (Betrag, Datum, Methode)
   */
  addPayment: (id: string, body: CreatePaymentBody) =>
    apiClient.post<InvoicePayment>(`/invoices/${id}/payments`, body),
  /**
   * DELETE /invoices/:id/payments/:paymentId – Löscht eine erfasste Zahlung.
   * @param id - Rechnungs-ID
   * @param paymentId - Zahlungs-ID
   */
  removePayment: (id: string, paymentId: string) =>
    apiClient.delete<unknown>(`/invoices/${id}/payments/${paymentId}`),

  /**
   * Erzeugt die URL zum Rechnungs-PDF (für direkten Download).
   * @param id - Rechnungs-ID
   */
  pdfUrl: (id: string) => `${API_BASE_URL}/invoices/${id}/pdf`,
};

// ── Helfer ─────────────────────────────────────────────────────

/** Beträge stets mit 2 Dezimalstellen + €-Zeichen (de-DE). */
export function formatCurrency(value: number | null | undefined): string {
  const n = value ?? 0;
  return n.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Summe der erfassten Zahlungen (paidAmount oder Fallback über payments). */
export function paidTotal(invoice: {
  paidAmount?: number | null;
  payments?: { amount: number }[];
}): number {
  if (invoice.paidAmount != null) return invoice.paidAmount;
  return (invoice.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
}

/** Offener Restbetrag einer Rechnung. */
export function openAmount(invoice: {
  total: number;
  paidAmount?: number | null;
  payments?: { amount: number }[];
}): number {
  return Math.max(0, invoice.total - paidTotal(invoice));
}

/** true, wenn die Rechnung offen und über das Fälligkeitsdatum hinaus ist. */
export function isOverdue(invoice: {
  status: InvoiceStatus;
  dueDate: string | null;
}): boolean {
  if (invoice.status !== 'SENT' && invoice.status !== 'PARTIALLY_PAID') {
    return false;
  }
  if (!invoice.dueDate) return false;
  return new Date(invoice.dueDate).getTime() < Date.now();
}

/** Empfänger/Steller je nach Rechnungstyp (Kunde bzw. Subunternehmen). */
export function invoicePartyName(invoice: {
  invoiceType: InvoiceType;
  customer: { companyName: string } | null;
  subcontractor: { name: string } | null;
}): string {
  if (invoice.invoiceType === 'OUTGOING') {
    return invoice.customer?.companyName ?? '–';
  }
  return invoice.subcontractor?.name ?? '–';
}

/** Lädt das Rechnungs-PDF mit Office-Token und stößt den Download an. */
export async function downloadInvoicePdf(
  id: string,
  filename: string,
): Promise<void> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('office_token')
      : null;
  const res = await fetch(invoicesApi.pdfUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new ApiError(`PDF-Export fehlgeschlagen (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
