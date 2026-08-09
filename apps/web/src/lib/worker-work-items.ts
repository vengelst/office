/**
 * API-Helfer für Monteur-Work-Items (Claim/Session/Report).
 */

import { ApiError } from './api-client';
import { getWorkerToken, workerFetch, workerUpload } from './timesheets';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

// ── Basis-Typen (Spiegel der API-Responses) ────────────────────

/**
 * Typ/Interface `WorkItemStatus` für die Web-App.
 */
export type WorkItemStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'REWORK'
  | 'APPROVED';

/**
 * Typ/Interface `WorkItemReportType` für die Web-App.
 */
export type WorkItemReportType = 'COMPLETED' | 'REWORK';
/**
 * Typ/Interface `WorkItemReviewAction` für die Web-App.
 */
export type WorkItemReviewAction = 'APPROVE' | 'FORCE_COMPLETE';

/** Block (PDF-Gruppe), wie er am Item hängt. */
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

/** Materialzeile (DE + SK, wie auf der Arbeitskarte). */
export interface WorkItemMaterial {
  id: string;
  sortOrder: number;
  /** Decimal aus Prisma → als String serialisiert. */
  qty: string | null;
  qtyUnit: string | null;
  materialDe: string;
  materialSk: string | null;
}

/** Zeitsession eines Monteurs am Item (Item-Zeit, SPEZ 8.2). */
export interface WorkItemSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  worker: { id: string; firstName: string; lastName: string };
}

/** Rückmeldung des Monteurs inkl. Foto-Dokument-IDs. */
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

/** Schlanke Projektion (`listSelect`) für die Listen. */
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
  _count: { materials: number; reports: number };
}

/** Vollständige Detailansicht (`detailSelect` + `photoDocumentIds`). */
export interface WorkItemDetail extends WorkItemListEntry {
  /** Am Block hängt ein PDF – Button „Plan / PDF“ nur dann anbieten. */
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

/** Laufende Item-Session des Monteurs ("aktuelles Item"). */
export interface CurrentWorkItemSession {
  id: string;
  startedAt: string;
  workItem: {
    id: string;
    itemKey: string;
    title: string | null;
    projectId: string;
  };
}

/** Antwort von `GET /workers/me/work-items`. */
export interface MyWorkItemsResponse {
  /** Item-basierte Projekte, denen der Monteur zugeordnet ist. */
  projectIds: string[];
  /** Eigene Items (aktive Zuordnung). */
  mine: WorkItemListEntry[];
  /** Offener Pool (`OPEN`) der eigenen Projekte. */
  open: WorkItemListEntry[];
  currentSession: CurrentWorkItemSession | null;
}

/** Eine Zeitsession, wie die Start-/Stop-Endpunkte sie zurückgeben. */
interface SessionRecord {
  id: string;
  workItemId: string;
  workerId: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
}

/** Antwort von `POST /work-items/:id/sessions/start`. */
export interface StartSessionResponse {
  session: SessionRecord;
  closedPreviousSessions: number;
}

/** Antwort von `POST /work-items/:id/sessions/stop`. */
export interface StopSessionResponse {
  sessions: SessionRecord[];
  totalMinutes: number;
}

/** Antwort der Fertig-/Nacharbeitsmeldung. */
export interface WorkItemReportResponse {
  report: {
    id: string;
    type: WorkItemReportType;
    comment: string | null;
    reportedAt: string;
    photoDocumentIds: string[];
  };
  workItem: WorkItemDetail;
}

/**
 * Mindestanzahl Fotos einer Fertigmeldung – spiegelt `MIN_COMPLETION_PHOTOS`
 * aus `work-item-workflow.service.ts` (SPEZ 4.1: 2–3 Fotos).
 */
export const MIN_COMPLETION_PHOTOS = 2;

// ── Helfer ─────────────────────────────────────────────────────

/** Hängt die ausgewählten Fotos als Multipart-Feld `photos` an. */
function appendPhotos(form: FormData, photos: File[]): void {
  photos.forEach((photo, index) => {
    form.append('photos', photo, photo.name || `foto-${index + 1}.jpg`);
  });
}

/**
 * Ort eines Items als eine Zeile: "EG · Flur · Raum 1.02".
 */
export function formatLocation(item: {
  floor: string | null;
  area: string | null;
  room: string | null;
}): string {
  return [item.floor, item.area, item.room].filter(Boolean).join(' · ');
}

/**
 * Menge + Einheit einer Materialzeile ("3 Stk"); trimmt "3.00" auf "3".
 *
 * @param line - Parameter `line` (WorkItemMaterial)
 * @returns string
 */
export function formatQty(line: WorkItemMaterial): string {
  let qty = '';
  if (line.qty) {
    const num = Number(line.qty);
    qty = Number.isFinite(num) ? String(num) : line.qty;
  }
  return [qty, line.qtyUnit].filter(Boolean).join(' ');
}

/**
 * Datum + Uhrzeit einer Rückmeldung/Kontrolle ("07.08.2026, 14:32").
 *
 * @param iso - Parameter `iso` (string | null | undefined)
 * @returns string
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Block-PDF (Unterlage) ──────────────────────────────────────

/** Warum das Öffnen der Unterlage fehlgeschlagen ist (Texte in `i18n-work-items`). */
export type WorkItemPdfFailure =
  | 'unauthorized'
  | 'notFound'
  | 'noViewer'
  | 'download';

/** Fehler beim Laden des Block-PDFs – die UI zeigt den Grund DE + SK. */
export class WorkItemPdfError extends Error {
  readonly reason: WorkItemPdfFailure;

  constructor(reason: WorkItemPdfFailure) {
    super(`Block-PDF nicht verfügbar (${reason})`);
    this.name = 'WorkItemPdfError';
    this.reason = reason;
  }
}

/** Dateinamen-tauglicher Rest einer Kennung ("05-A/01" → "05-a-01"). */
function fileSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'plan'
  );
}

/** Blob-URL des Block-PDFs samt Dateiname für den Download-Fallback. */
export interface WorkItemPdfBlob {
  url: string;
  filename: string;
}

/**
 * Lädt das Block-PDF des Items als Blob (SPEZ 6.5 „Unterlage öffnen“).
 *
 * Der Endpunkt verlangt das Worker-Bearer-Token, das weder ein `<a href>` noch
 * ein `<iframe src>` mitschicken würde. Deshalb holt der Client die Datei per
 * `fetch` und gibt eine Blob-URL zurück; die UI zeigt sie im Overlay an und
 * bietet sie zusätzlich als Link/Download an (iOS Safari rendert PDFs im
 * `<iframe>` nicht zuverlässig).
 *
 * Der Aufrufer ist für `URL.revokeObjectURL(url)` verantwortlich.
 *
 * @throws WorkItemPdfError mit dem Grund für die Anzeige DE + SK
 */
export async function loadWorkItemPdf(item: {
  id: string;
  itemKey: string;
  block: WorkItemBlockRef | null;
}): Promise<WorkItemPdfBlob> {
  const token = getWorkerToken();
  if (!token) throw new WorkItemPdfError('unauthorized');

  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/workers/me/work-items/${item.id}/pdf?inline=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    throw new WorkItemPdfError('download');
  }

  if (!res.ok) {
    if (res.status === 404) throw new WorkItemPdfError('notFound');
    if (res.status === 401 || res.status === 403) {
      throw new WorkItemPdfError('unauthorized');
    }
    throw new WorkItemPdfError('download');
  }

  const blob = await res.blob();
  // Der Browser braucht den PDF-MIME-Typ, sonst lädt er die Datei nur herunter.
  const pdf =
    blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' });

  return {
    url: URL.createObjectURL(pdf),
    filename: `plan-${fileSlug(item.block?.blockKey ?? item.itemKey)}.pdf`,
  };
}

// ── API (Worker-Token) ─────────────────────────────────────────

export const workerWorkItemsApi = {
  /** Eigene Items, offener Pool und laufende Session (optional je Projekt). */
  mine: (projectId?: string) =>
    workerFetch<MyWorkItemsResponse>(
      projectId
        ? `/workers/me/work-items?projectId=${encodeURIComponent(projectId)}`
        : '/workers/me/work-items',
    ),

  /** Item-Detail für den Monteur. */
  one: (id: string) => workerFetch<WorkItemDetail>(`/workers/me/work-items/${id}`),

  /** Item nehmen: OPEN → IN_PROGRESS. */
  claim: (id: string) =>
    workerFetch<WorkItemDetail>(`/work-items/${id}/claim`, { method: 'POST' }),

  /** Aktuelles Item setzen – beendet zuvor alle offenen Sessions. */
  startSession: (id: string) =>
    workerFetch<StartSessionResponse>(`/work-items/${id}/sessions/start`, {
      method: 'POST',
      body: {},
    }),

  /** Laufende Session an diesem Item beenden. */
  stopSession: (id: string) =>
    workerFetch<StopSessionResponse>(`/work-items/${id}/sessions/stop`, {
      method: 'POST',
      body: {},
    }),

  /** Fertigmeldung – mindestens 2 Fotos (die API weist weniger mit 400 ab). */
  complete: (id: string, photos: File[], comment?: string) => {
    const form = new FormData();
    appendPhotos(form, photos);
    if (comment?.trim()) form.append('comment', comment.trim());
    return workerUpload<WorkItemReportResponse>(
      `/work-items/${id}/reports/complete`,
      form,
    );
  },

  /** Nacharbeit melden – Fotos und Kommentar optional. */
  rework: (id: string, photos: File[], comment?: string) => {
    const form = new FormData();
    appendPhotos(form, photos);
    if (comment?.trim()) form.append('comment', comment.trim());
    return workerUpload<WorkItemReportResponse>(
      `/work-items/${id}/reports/rework`,
      form,
    );
  },

  /** Blob-URL des Block-PDFs (siehe `loadWorkItemPdf`). */
  openPdf: loadWorkItemPdf,
};

/**
 * Fehlermeldung eines fehlgeschlagenen Aufrufs, sonst der Fallback-Text.
 *
 * @param err - Parameter `err`
 * @param fallback - Parameter `fallback` (string)
 * @returns string
 */
export function apiMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
