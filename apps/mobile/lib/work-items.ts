/**
 * Arbeitsitems in der Monteur-App (SPEZ-arbeitsitems.md Abschnitte 4.1, 5, 6, 8.2).
 *
 * Die Typen spiegeln exakt die Response-Shapes der Monteur-Endpunkte aus
 * `apps/api/src/work-items/` wider:
 *  - `WorkItemsService.findForWorker`    → `MyWorkItemsResponse`
 *  - `WorkItemsService.findOneForWorker` → `WorkItemDetail` (= `findOne`)
 *
 * Rückmeldungen laufen als Multipart (Feld `photos`) über `apiUpload`.
 */
import { apiFetch, apiUpload } from './api';

// ── Basis-Typen ────────────────────────────────────────────────

export type WorkItemStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'REWORK'
  | 'APPROVED';

export type WorkItemReportType = 'COMPLETED' | 'REWORK';
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

/** Antwort von `POST /work-items/:id/sessions/start`. */
export interface StartSessionResponse {
  session: {
    id: string;
    workItemId: string;
    workerId: string;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number | null;
  };
  closedPreviousSessions: number;
}

/** Antwort von `POST /work-items/:id/sessions/stop`. */
export interface StopSessionResponse {
  sessions: Array<{
    id: string;
    workItemId: string;
    workerId: string;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number | null;
  }>;
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

/** Ein für den Upload ausgewähltes Foto (Kamera oder Galerie). */
export interface PickedPhoto {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

/**
 * Mindestanzahl Fotos einer Fertigmeldung – spiegelt `MIN_COMPLETION_PHOTOS`
 * aus `work-item-workflow.service.ts` (SPEZ 4.1: 2–3 Fotos).
 */
export const MIN_COMPLETION_PHOTOS = 2;

// ── Helfer ─────────────────────────────────────────────────────

/** Hängt die ausgewählten Fotos als Multipart-Feld `photos` an. */
function appendPhotos(form: FormData, photos: PickedPhoto[]): void {
  photos.forEach((photo, index) => {
    const name = photo.fileName ?? photo.uri.split('/').pop() ?? `foto-${index + 1}.jpg`;
    form.append('photos', {
      uri: photo.uri,
      name,
      type: photo.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
  });
}

/** Ort eines Items als eine Zeile: "EG · Flur · Raum 1.02". */
export function formatLocation(item: {
  floor: string | null;
  area: string | null;
  room: string | null;
}): string {
  return [item.floor, item.area, item.room].filter(Boolean).join(' · ');
}

/** Menge + Einheit einer Materialzeile ("3 Stk"); trimmt "3.00" auf "3". */
export function formatQty(line: WorkItemMaterial): string {
  let qty = '';
  if (line.qty) {
    const num = Number(line.qty);
    qty = Number.isFinite(num) ? String(num) : line.qty;
  }
  return [qty, line.qtyUnit].filter(Boolean).join(' ');
}

// ── API ────────────────────────────────────────────────────────

export const workItemsApi = {
  /** Eigene Items, offener Pool und laufende Session (optional je Projekt). */
  mine: (projectId?: string) =>
    apiFetch<MyWorkItemsResponse>(
      projectId
        ? `/workers/me/work-items?projectId=${encodeURIComponent(projectId)}`
        : '/workers/me/work-items',
    ),

  /** Item-Detail für den Monteur. */
  one: (id: string) => apiFetch<WorkItemDetail>(`/workers/me/work-items/${id}`),

  /** Item nehmen: OPEN → IN_PROGRESS. */
  claim: (id: string) =>
    apiFetch<WorkItemDetail>(`/work-items/${id}/claim`, { method: 'POST' }),

  /** Aktuelles Item setzen – beendet zuvor alle offenen Sessions. */
  startSession: (id: string) =>
    apiFetch<StartSessionResponse>(`/work-items/${id}/sessions/start`, {
      method: 'POST',
      body: {},
    }),

  /** Laufende Session an diesem Item beenden. */
  stopSession: (id: string) =>
    apiFetch<StopSessionResponse>(`/work-items/${id}/sessions/stop`, {
      method: 'POST',
      body: {},
    }),

  /** Fertigmeldung – mindestens 2 Fotos (die API weist weniger mit 400 ab). */
  complete: (id: string, photos: PickedPhoto[], comment?: string) => {
    const form = new FormData();
    appendPhotos(form, photos);
    if (comment?.trim()) form.append('comment', comment.trim());
    return apiUpload<WorkItemReportResponse>(
      `/work-items/${id}/reports/complete`,
      form,
    );
  },

  /** Nacharbeit melden – Fotos und Kommentar optional. */
  rework: (id: string, photos: PickedPhoto[], comment?: string) => {
    const form = new FormData();
    appendPhotos(form, photos);
    if (comment?.trim()) form.append('comment', comment.trim());
    return apiUpload<WorkItemReportResponse>(
      `/work-items/${id}/reports/rework`,
      form,
    );
  },
};
