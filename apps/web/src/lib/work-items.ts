/**
 * Typen und API-Funktionen für die Arbeitsitems (SPEZ-arbeitsitems.md).
 * Spiegelt die Büro-/Admin-Endpoints aus `apps/api/src/work-items/` wider
 * sowie die Kunden-PL-Endpoints (`/pl/**`, siehe `customerPlApi` unten).
 *
 * Der Excel-/CSV-Import läuft als Multipart-Upload (Feld `files`) und daher
 * nicht über `apiClient` (JSON), sondern über `apiUpload` aus `api-client.ts`.
 * Fotos sind Binärdaten und laufen über `fetch` mit Bearer-Token.
 */
import { ApiError, apiClient, apiUpload, TOKEN_STORAGE_KEY } from './api-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

// ── Basis-Typen ────────────────────────────────────────────────

export type WorkItemStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'REWORK'
  | 'APPROVED';

/** Alle Status in Workflow-Reihenfolge (Filter, Zähler, Board-Spalten). */
export const WORK_ITEM_STATUSES: WorkItemStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'REVIEW',
  'REWORK',
  'APPROVED',
];

export type WorkItemReportType = 'COMPLETED' | 'REWORK';
export type WorkItemReviewAction = 'APPROVE' | 'FORCE_COMPLETE';

/** Block (PDF-Gruppe) eines Projekts inkl. Item-Anzahl. */
export interface ProjectBlock {
  id: string;
  projectId: string;
  blockKey: string;
  name: string | null;
  pdfDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { workItems: number };
}

/** Block-Kurzform, wie sie am Item hängt. */
export interface WorkItemBlockRef {
  id: string;
  blockKey: string;
  name: string | null;
  pdfDocumentId: string | null;
}

/** Aktive Zuordnung eines Monteurs zu einem Item. */
export interface WorkItemAssignment {
  id: string;
  startedAt: string;
  worker: {
    id: string;
    workerNumber: string;
    firstName: string;
    lastName: string;
  };
}

/** Eine Materialzeile eines Items. */
export interface WorkItemMaterial {
  id: string;
  sortOrder: number;
  qty: string | null;
  qtyUnit: string | null;
  materialDe: string;
  materialSk: string | null;
}

/** Zeitsession eines Monteurs am Item. */
export interface WorkItemSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  worker: { id: string; firstName: string; lastName: string };
}

/** Rückmeldung des Monteurs (Fertig/Nacharbeit) inkl. Foto-Dokument-IDs. */
export interface WorkItemReport {
  id: string;
  type: WorkItemReportType;
  comment: string | null;
  reportedAt: string;
  worker: { id: string; firstName: string; lastName: string };
  photoDocumentIds: string[];
}

/** Prüfung durch den Kunden-PL. */
export interface WorkItemReview {
  id: string;
  action: WorkItemReviewAction;
  comment: string | null;
  reviewedAt: string;
  reviewer: { id: string; displayName: string } | null;
}

/** Schlanke Projektion für Liste/Board. */
export interface WorkItemListEntry {
  id: string;
  itemKey: string;
  title: string | null;
  status: WorkItemStatus;
  floor: string | null;
  area: string | null;
  room: string | null;
  type: string | null;
  rc: string | null;
  detail: string | null;
  planPage: number | null;
  pdfFile: string | null;
  pdfPage: number | null;
  importedAt: string | null;
  updatedAt: string;
  block: WorkItemBlockRef | null;
  assignments: WorkItemAssignment[];
  /** Nur die jüngste Rückmeldung (Board-Spalte „letzte Meldung“). */
  reports: Array<{
    id: string;
    type: WorkItemReportType;
    reportedAt: string;
  }>;
  _count: { materials: number; reports: number };
}

/** Vollständige Item-Detailansicht. */
export interface WorkItemDetail extends WorkItemListEntry {
  /** Am Block hängt ein PDF (abgeleitet aus `block.pdfDocumentId`). */
  hasPdf: boolean;
  projectId: string;
  workScopeDe: string | null;
  workScopeSk: string | null;
  sheetNo: number | null;
  sheetTotal: number | null;
  createdAt: string;
  project: {
    id: string;
    projectNumber: string;
    title: string;
    itemBased: boolean;
  };
  materials: WorkItemMaterial[];
  sessions: WorkItemSession[];
  reports: WorkItemReport[];
  reviews: WorkItemReview[];
}

/** Antwort der Item-Liste inkl. Status-Zähler über das ganze Projekt. */
export interface WorkItemListResponse {
  items: WorkItemListEntry[];
  total: number;
  take: number;
  skip: number;
  statusCounts: Record<WorkItemStatus, number>;
}

/** Filter der Item-Liste. */
export interface WorkItemListParams {
  /** Ein oder mehrere Status, komma-separiert. */
  status?: string;
  blockKey?: string;
  /** Suche in Kennung/Titel/Raum. */
  q?: string;
  take?: number;
  skip?: number;
}

/** Item-Zeit: Summe je Monteur plus alle Sessions. */
export interface WorkItemTimeSummary {
  totalMinutes: number;
  perWorker: Array<{
    workerId: string;
    name: string;
    minutes: number;
    sessions: number;
    open: number;
  }>;
  sessions: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    minutes: number | null;
    worker: { id: string; firstName: string; lastName: string };
  }>;
}

/** Zusammenfassung eines Import-/Vorschaulaufs. */
export interface WorkItemImportSummary {
  dryRun: boolean;
  itemsCreated: number;
  itemsUpdated: number;
  blocksCreated: number;
  materialLinesImported: number;
  itemsWithMaterialsReplaced: number;
  orphanMaterialRows: number;
  warnings: string[];
  sources: string[];
  itemKeys: string[];
}

/** Optionen des Imports (als Multipart-Felder neben den Dateien). */
export interface WorkItemImportOptions {
  /** Projekt automatisch auf itemBased=true setzen (Default der API: true). */
  setItemBased?: boolean;
  csvDelimiter?: string;
}

// ── PDF-Import (Primär) ──────────────────────────────────────────

/** Ein Item in der PDF-Vorschau-Antwort. */
export interface PdfPreviewItem {
  pdfPage: number;
  itemKey: string;
  title: string;
  workScopeDe: string | null;
  workScopeSk: string | null;
  floor: string | null;
  room: string | null;
  conflicts: string[];
  ocrWarnings: string[];
}

/** Antwort des PDF-Preview-Endpunkts. */
export interface PdfPreviewResponse {
  pageCount: number;
  blockKey: string;
  items: PdfPreviewItem[];
  warnings: string[];
}

/** Antwort des PDF-Commit-Endpunkts. */
export interface PdfCommitResponse {
  itemsCreated: number;
  itemsUpdated: number;
  blockId: string;
  documentId: string | null;
}

/** Optionen für die PDF-Import-Vorschau. */
export interface PdfImportPreviewOptions {
  blockKey: string;
  blockName?: string;
  itemKeyPrefix?: string;
  startPage?: number;
  endPage?: number;
  setItemBased?: boolean;
  templateId?: string;
  extract?: boolean;
}

/** Ein Item, das der Nutzer editiert und an den Commit schickt. */
export interface PdfImportCommitItem {
  pdfPage: number;
  itemKey: string;
  title?: string;
  workScopeDe?: string;
  workScopeSk?: string;
  floor?: string;
  room?: string;
}

/** Optionen für den PDF-Import-Commit. */
export interface PdfImportCommitOptions {
  blockKey: string;
  blockName?: string;
  pdfDocumentId?: string;
  setItemBased?: boolean;
  items: PdfImportCommitItem[];
}

/** Benutzer mit Rolle CUSTOMER_PL. */
export interface CustomerPlUser {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
}

/** Kunden-PL-Zuordnung an einem Projekt. */
export interface CustomerPlAssignment {
  id: string;
  projectId: string;
  userId: string;
  active: boolean;
  createdAt: string;
  user: CustomerPlUser;
}

/** Projekt in der Kunden-PL-Übersicht (`GET /pl/projects`). */
export interface CustomerPlProject {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  itemBased: boolean;
  customer: { id: string; companyName: string } | null;
  _count: { workItems: number };
}

/** Board-Antwort des Kunden-PLs inkl. Projektkopf. */
export interface CustomerPlBoardResponse extends WorkItemListResponse {
  project: {
    id: string;
    projectNumber: string;
    title: string;
    itemBased: boolean;
  } | null;
}

/** Antwort einer Prüfung (approve / force-complete). */
export interface WorkItemReviewResult {
  review: {
    id: string;
    action: WorkItemReviewAction;
    comment: string | null;
    reviewedAt: string;
  };
  workItem: WorkItemDetail;
}

// ── Anlege-/Änderungs-Payloads ─────────────────────────────────

export interface CreateBlockPayload {
  blockKey: string;
  name?: string;
  pdfDocumentId?: string;
}

export interface UpdateBlockPayload {
  blockKey?: string;
  name?: string;
  /** `null` löst die PDF-Verknüpfung. */
  pdfDocumentId?: string | null;
}

export interface WorkItemPayload {
  itemKey?: string;
  blockKey?: string;
  title?: string;
  floor?: string;
  area?: string;
  room?: string;
  type?: string;
  rc?: string;
  detail?: string;
  planPage?: number;
  sheetNo?: number;
  sheetTotal?: number;
  pdfFile?: string;
  pdfPage?: number;
  workScopeDe?: string;
  workScopeSk?: string;
}

export interface MaterialLinePayload {
  sortOrder?: number;
  qty?: string;
  qtyUnit?: string;
  materialDe: string;
  materialSk?: string;
}

// ── Status-Labels (DE) ─────────────────────────────────────────

/**
 * Deutsches Label eines Item-Status. Die Zuordnung liegt bewusst hier
 * (nicht in `texts.ts`), damit Typ und Label zusammen gepflegt werden.
 */
export const WORK_ITEM_STATUS_LABELS: Record<WorkItemStatus, string> = {
  OPEN: 'Offen',
  IN_PROGRESS: 'In Arbeit',
  REVIEW: 'Kontrolle',
  REWORK: 'Nacharbeit',
  APPROVED: 'Geprüft',
};

/** Deutsches Label eines Rückmeldungstyps. */
export const WORK_ITEM_REPORT_LABELS: Record<WorkItemReportType, string> = {
  COMPLETED: 'Fertigmeldung',
  REWORK: 'Nacharbeit gemeldet',
};

/** Deutsches Label einer Kunden-PL-Prüfung. */
export const WORK_ITEM_REVIEW_LABELS: Record<WorkItemReviewAction, string> = {
  APPROVE: 'Geprüft',
  FORCE_COMPLETE: 'Vom Kunden-PL fertiggesetzt',
};

/** Minuten als "3 h 05 min" (leer bei 0). */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

// ── API ────────────────────────────────────────────────────────

/** Baut das FormData für Import und Vorschau. */
function buildImportForm(
  files: File[],
  options: WorkItemImportOptions = {},
): FormData {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  if (options.setItemBased !== undefined) {
    form.append('setItemBased', String(options.setItemBased));
  }
  if (options.csvDelimiter) {
    form.append('csvDelimiter', options.csvDelimiter);
  }
  return form;
}

/** API-Client für Blöcke, Items, Material, Import und Kunden-PLs. */
export const workItemsApi = {
  // Blöcke
  listBlocks: (projectId: string): Promise<ProjectBlock[]> =>
    apiClient.get<ProjectBlock[]>(`/projects/${projectId}/blocks`),
  createBlock: (
    projectId: string,
    body: CreateBlockPayload,
  ): Promise<ProjectBlock> =>
    apiClient.post<ProjectBlock>(`/projects/${projectId}/blocks`, body),
  updateBlock: (
    projectId: string,
    blockId: string,
    body: UpdateBlockPayload,
  ): Promise<ProjectBlock> =>
    apiClient.patch<ProjectBlock>(
      `/projects/${projectId}/blocks/${blockId}`,
      body,
    ),
  removeBlock: (projectId: string, blockId: string): Promise<unknown> =>
    apiClient.delete<unknown>(`/projects/${projectId}/blocks/${blockId}`),

  // Items
  listItems(
    projectId: string,
    params: WorkItemListParams = {},
  ): Promise<WorkItemListResponse> {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.blockKey) q.set('blockKey', params.blockKey);
    if (params.q) q.set('q', params.q);
    if (params.take) q.set('take', String(params.take));
    if (params.skip) q.set('skip', String(params.skip));
    const qs = q.toString();
    return apiClient.get<WorkItemListResponse>(
      `/projects/${projectId}/work-items${qs ? `?${qs}` : ''}`,
    );
  },
  createItem: (
    projectId: string,
    body: WorkItemPayload & { itemKey: string },
  ): Promise<WorkItemDetail> =>
    apiClient.post<WorkItemDetail>(`/projects/${projectId}/work-items`, body),
  getItem: (id: string): Promise<WorkItemDetail> =>
    apiClient.get<WorkItemDetail>(`/work-items/${id}`),
  updateItem: (id: string, body: WorkItemPayload): Promise<WorkItemDetail> =>
    apiClient.patch<WorkItemDetail>(`/work-items/${id}`, body),
  removeItem: (id: string): Promise<unknown> =>
    apiClient.delete<unknown>(`/work-items/${id}`),

  // Material
  listMaterials: (id: string): Promise<WorkItemMaterial[]> =>
    apiClient.get<WorkItemMaterial[]>(`/work-items/${id}/materials`),
  replaceMaterials: (
    id: string,
    materials: MaterialLinePayload[],
  ): Promise<WorkItemMaterial[]> =>
    apiClient.put<WorkItemMaterial[]>(`/work-items/${id}/materials`, {
      materials,
    }),

  // Item-Zeit
  itemTime: (id: string): Promise<WorkItemTimeSummary> =>
    apiClient.get<WorkItemTimeSummary>(`/work-items/${id}/time`),

  // Import (Multipart-Feld `files`)
  previewImport: (
    projectId: string,
    files: File[],
    options?: WorkItemImportOptions,
  ): Promise<WorkItemImportSummary> =>
    apiUpload<WorkItemImportSummary>(
      `/projects/${projectId}/work-items/import/preview`,
      buildImportForm(files, options),
    ),
  runImport: (
    projectId: string,
    files: File[],
    options?: WorkItemImportOptions,
  ): Promise<WorkItemImportSummary> =>
    apiUpload<WorkItemImportSummary>(
      `/projects/${projectId}/work-items/import`,
      buildImportForm(files, options),
    ),

  // PDF-Import (Primär)
  previewPdfImport: (
    projectId: string,
    file: File,
    options: PdfImportPreviewOptions,
    request?: { signal?: AbortSignal },
  ): Promise<PdfPreviewResponse> => {
    const form = new FormData();
    form.append('file', file);
    form.append('blockKey', options.blockKey);
    if (options.blockName) form.append('blockName', options.blockName);
    if (options.itemKeyPrefix) form.append('itemKeyPrefix', options.itemKeyPrefix);
    if (options.startPage !== undefined) form.append('startPage', String(options.startPage));
    if (options.endPage !== undefined) form.append('endPage', String(options.endPage));
    if (options.setItemBased !== undefined) form.append('setItemBased', String(options.setItemBased));
    // "none" / leer nie mitschicken – sonst 400 „Template none nicht gefunden“
    const tid = options.templateId?.trim();
    if (tid && tid !== 'none') form.append('templateId', tid);
    if (options.extract !== undefined) form.append('extract', String(options.extract));
    return apiUpload<PdfPreviewResponse>(
      `/projects/${projectId}/work-items/import-pdf/preview`,
      form,
      request,
    );
  },
  runPdfImport: (
    projectId: string,
    file: File | null,
    options: PdfImportCommitOptions,
    request?: { signal?: AbortSignal },
  ): Promise<PdfCommitResponse> => {
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('blockKey', options.blockKey);
    if (options.blockName) form.append('blockName', options.blockName);
    if (options.pdfDocumentId) form.append('pdfDocumentId', options.pdfDocumentId);
    if (options.setItemBased !== undefined) form.append('setItemBased', String(options.setItemBased));
    form.append('items', JSON.stringify(options.items));
    return apiUpload<PdfCommitResponse>(
      `/projects/${projectId}/work-items/import-pdf`,
      form,
      request,
    );
  },

  // Kunden-PL
  listCustomerPls: (projectId: string): Promise<CustomerPlAssignment[]> =>
    apiClient.get<CustomerPlAssignment[]>(`/projects/${projectId}/customer-pls`),
  listCustomerPlCandidates: (projectId: string): Promise<CustomerPlUser[]> =>
    apiClient.get<CustomerPlUser[]>(
      `/projects/${projectId}/customer-pls/candidates`,
    ),
  addCustomerPl: (
    projectId: string,
    userId: string,
  ): Promise<CustomerPlAssignment> =>
    apiClient.post<CustomerPlAssignment>(`/projects/${projectId}/customer-pls`, {
      userId,
    }),
  removeCustomerPl: (projectId: string, userId: string): Promise<unknown> =>
    apiClient.delete<unknown>(`/projects/${projectId}/customer-pls/${userId}`),
};

// ── Kunden-PL (Rolle CUSTOMER_PL) ──────────────────────────────

/** Query-String der Board-Filter (identisch zur Büro-Liste). */
function boardQuery(params: WorkItemListParams): string {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.blockKey) q.set('blockKey', params.blockKey);
  if (params.q) q.set('q', params.q);
  if (params.take) q.set('take', String(params.take));
  if (params.skip) q.set('skip', String(params.skip));
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Lädt ein Foto der Fertigmeldung als Object-URL.
 * Der Kunden-PL hat bewusst keinen Zugriff auf `/documents/:id/download`;
 * der Stream läuft item-gebunden über `/pl/work-items/:id/photos/:documentId`.
 * Der Aufrufer ist für `URL.revokeObjectURL()` verantwortlich.
 */
async function plPhotoObjectUrl(
  itemId: string,
  documentId: string,
): Promise<string> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;
  const res = await fetch(
    `${API_BASE_URL}/pl/work-items/${itemId}/photos/${documentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  if (!res.ok) {
    throw new ApiError(`Foto konnte nicht geladen werden (${res.status})`, res.status);
  }
  return URL.createObjectURL(await res.blob());
}

/**
 * API-Client des Kunden-PLs: eigene Projekte, Board, Item-Detail, Fotos
 * sowie Prüfen (approve) und Selbst-Fertigsetzen (force-complete).
 * Alle Endpunkte sind serverseitig auf die zugewiesenen Projekte begrenzt.
 */
export const customerPlApi = {
  /** GET /pl/projects – item-basierte Projekte mit aktiver Kunden-PL-Zuordnung. */
  projects: (): Promise<CustomerPlProject[]> =>
    apiClient.get<CustomerPlProject[]>('/pl/projects'),

  /** GET /pl/projects/:projectId/work-items – Board-Daten inkl. Status-Zähler. */
  workItems: (
    projectId: string,
    params: WorkItemListParams = {},
  ): Promise<CustomerPlBoardResponse> =>
    apiClient.get<CustomerPlBoardResponse>(
      `/pl/projects/${projectId}/work-items${boardQuery(params)}`,
    ),

  /** GET /pl/work-items/:id – Item-Detail inkl. Foto-IDs der Rückmeldungen. */
  workItem: (id: string): Promise<WorkItemDetail> =>
    apiClient.get<WorkItemDetail>(`/pl/work-items/${id}`),

  /** Foto einer Rückmeldung als Object-URL (authentifiziert, item-gebunden). */
  photoObjectUrl: plPhotoObjectUrl,

  /** POST /work-items/:id/reviews/approve – Kontrolle bestanden → Geprüft. */
  approve: (id: string, comment?: string): Promise<WorkItemReviewResult> =>
    apiClient.post<WorkItemReviewResult>(`/work-items/${id}/reviews/approve`, {
      comment,
    }),

  /** POST /work-items/:id/reviews/force-complete – PL setzt selbst fertig. */
  forceComplete: (id: string, comment?: string): Promise<WorkItemReviewResult> =>
    apiClient.post<WorkItemReviewResult>(
      `/work-items/${id}/reviews/force-complete`,
      { comment },
    ),
};
