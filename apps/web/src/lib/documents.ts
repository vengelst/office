/**
 * API-Client + Typen für das Dokumenten-System (Upload, Versionen, Ordner,
 * Thumbnails, Vorschau, globale Suche).
 *
 * Multipart-Uploads und Binär-Downloads laufen NICHT über `apiClient`
 * (der kann nur JSON), sondern über `fetch` mit manuellem Bearer-Token.
 */
import { apiClient, ApiError, TOKEN_STORAGE_KEY } from './api-client';
import type { ApiErrorResponse } from '@office/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

// ── Typen ──────────────────────────────────────────────────────

/** Verknüpfung eines Dokuments mit einer Entität (Kunde/Projekt/…). */
export interface DocumentLink {
  id: string;
  entityType: string;
  entityId: string;
  folderId: string | null;
}

/** Ordner zur logischen Gliederung der Dokumente einer Entität. */
export interface DocumentFolder {
  id: string;
  entityType: string;
  entityId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

/** Ein Dokument (aktuelle oder historische Version). */
export interface Document {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  storagePath: string | null;
  thumbnailKey: string | null;
  version: number;
  replacesId: string | null;
  isLatest: boolean;
  expiryDate: string | null;
  tags: string | null;
  uploadSource: string | null;
  uploadedBy: { id: string; displayName: string } | null;
  links: DocumentLink[];
}

/** Dokument-Detail inkl. Versions-Historie. */
export interface DocumentDetail extends Document {
  replacedBy: Document | null;
  previousVersions: Document[];
}

/** Filter für die (globale) Dokumenten-Suche. */
export interface DocumentListParams {
  entityType?: string;
  entityId?: string;
  folderId?: string;
  documentType?: string;
  search?: string;
}

/** Metadaten pro Datei beim Upload. */
export interface UploadMeta {
  documentType: string;
  title?: string;
  description?: string;
  tags?: string;
  expiryDate?: string;
  entityType?: string;
  entityId?: string;
  folderId?: string;
  uploadSource?: string;
}

// ── Hilfsfunktionen ────────────────────────────────────────────

/** True, wenn der MIME-Type ein im Browser darstellbares Bild ist. */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** True, wenn das Dokument ein PDF ist. */
export function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/** Liest das Office-JWT aus dem LocalStorage (null bei SSR). */
function getToken(): string | null {
  return typeof window !== 'undefined'
    ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
    : null;
}

/** Wirft einen strukturierten ApiError aus einer fehlgeschlagenen Response. */
async function throwFromResponse(res: Response, fallback: string): Promise<never> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson
    ? ((await res.json()) as ApiErrorResponse | null)
    : null;
  const message = payload
    ? Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message
    : `${fallback} (${res.status})`;
  throw new ApiError(message, res.status, payload ?? undefined);
}

/**
 * Lädt eine geschützte Binärdatei (Bild/PDF) als Object-URL.
 * Nötig, weil `<img>`/`window.open` keinen Authorization-Header senden können.
 * Der Aufrufer ist für `URL.revokeObjectURL()` verantwortlich.
 */
async function fetchObjectUrl(path: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    await throwFromResponse(res, 'Laden fehlgeschlagen');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Baut ein FormData-Objekt aus Datei und Metadaten für den Upload. */
function buildForm(file: File, meta: UploadMeta): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', meta.documentType);
  if (meta.title) form.append('title', meta.title);
  if (meta.description) form.append('description', meta.description);
  if (meta.tags) form.append('tags', meta.tags);
  if (meta.expiryDate) form.append('expiryDate', meta.expiryDate);
  if (meta.entityType) form.append('entityType', meta.entityType);
  if (meta.entityId) form.append('entityId', meta.entityId);
  if (meta.folderId) form.append('folderId', meta.folderId);
  if (meta.uploadSource) form.append('uploadSource', meta.uploadSource);
  return form;
}

/**
 * Sendet ein FormData per XHR, damit der Upload-Fortschritt (0–100 %)
 * gemeldet werden kann (fetch kann das nicht).
 */
function sendForm<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e): void => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = (): void => {
      const isJson = xhr
        .getResponseHeader('content-type')
        ?.includes('application/json');
      const data: unknown = isJson ? JSON.parse(xhr.responseText) : null;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
        return;
      }
      const payload = (data as ApiErrorResponse | null) ?? undefined;
      const message = payload
        ? Array.isArray(payload.message)
          ? payload.message.join(', ')
          : payload.message
        : `Upload fehlgeschlagen (${xhr.status})`;
      reject(new ApiError(message, xhr.status, payload));
    };
    xhr.onerror = (): void =>
      reject(new ApiError('Netzwerkfehler beim Upload', 0));
    xhr.send(form);
  });
}

// ── API ────────────────────────────────────────────────────────

/** API-Client für das Dokumenten-System (Upload, Suche, Versionen, Vorschau, Download). */
export const documentsApi = {
  /** GET /documents – Dokumente auflisten/suchen (globale Suche oder gefiltert). */
  list(params: DocumentListParams = {}): Promise<Document[]> {
    const q = new URLSearchParams();
    if (params.entityType) q.set('entityType', params.entityType);
    if (params.entityId) q.set('entityId', params.entityId);
    if (params.folderId) q.set('folderId', params.folderId);
    if (params.documentType) q.set('documentType', params.documentType);
    if (params.search) q.set('search', params.search);
    const qs = q.toString();
    return apiClient.get<Document[]>(`/documents${qs ? `?${qs}` : ''}`);
  },

  /** Dokumente einer einzelnen Entität. */
  listByEntity(entityType: string, entityId: string): Promise<Document[]> {
    return documentsApi.list({ entityType, entityId });
  },

  /** Detail inkl. Versions-Historie. */
  get: (id: string): Promise<DocumentDetail> =>
    apiClient.get<DocumentDetail>(`/documents/${id}`),

  /** Kontextbezogene Dokumenttypen für einen Entitätstyp. */
  typesForContext: (entityType: string): Promise<string[]> =>
    apiClient.get<string[]>(
      `/documents/types-for-context?entityType=${encodeURIComponent(entityType)}`,
    ),

  /** Bald ablaufende Dokumente (nächste 30 Tage). */
  expiring: (): Promise<Document[]> =>
    apiClient.get<Document[]>('/documents/expiring'),

  /** Einzel-Upload (mit Fortschritt). */
  upload: (
    file: File,
    meta: UploadMeta,
    onProgress?: (percent: number) => void,
  ): Promise<Document> =>
    sendForm<Document>('/documents/upload', buildForm(file, meta), onProgress),

  /** Massen-Upload mehrerer Dateien mit identischem Kontext. */
  uploadMultiple: (
    files: File[],
    meta: UploadMeta,
    onProgress?: (percent: number) => void,
  ): Promise<Document[]> => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    form.append('documentType', meta.documentType);
    if (meta.title) form.append('title', meta.title);
    if (meta.description) form.append('description', meta.description);
    if (meta.tags) form.append('tags', meta.tags);
    if (meta.expiryDate) form.append('expiryDate', meta.expiryDate);
    if (meta.entityType) form.append('entityType', meta.entityType);
    if (meta.entityId) form.append('entityId', meta.entityId);
    if (meta.folderId) form.append('folderId', meta.folderId);
    if (meta.uploadSource) form.append('uploadSource', meta.uploadSource);
    return sendForm<Document[]>(
      '/documents/upload-multiple',
      form,
      onProgress,
    );
  },

  /** Dokument durch eine neue Version ersetzen. */
  replace: (
    id: string,
    file: File,
    meta: { tags?: string; expiryDate?: string; uploadSource?: string } = {},
    onProgress?: (percent: number) => void,
  ): Promise<Document> => {
    const form = new FormData();
    form.append('file', file);
    if (meta.tags) form.append('tags', meta.tags);
    if (meta.expiryDate) form.append('expiryDate', meta.expiryDate);
    if (meta.uploadSource) form.append('uploadSource', meta.uploadSource);
    return sendForm<Document>(`/documents/${id}/replace`, form, onProgress);
  },

  /** Dokument löschen (Storage + DB). */
  remove: (id: string): Promise<unknown> =>
    apiClient.delete<unknown>(`/documents/${id}`),

  /** Roh-URL zum Thumbnail (für Referenz – Laden via thumbnailObjectUrl). */
  thumbnailUrl: (id: string): string =>
    `${API_BASE_URL}/documents/${id}/thumbnail`,

  /** Roh-URL zum Download. */
  downloadUrl: (id: string): string => `${API_BASE_URL}/documents/${id}/download`,

  /** Thumbnail als Object-URL (authentifiziert). */
  thumbnailObjectUrl: (id: string): Promise<string> =>
    fetchObjectUrl(`/documents/${id}/thumbnail`),

  /** Vollbild/Original als Object-URL (authentifiziert) – für Lightbox & PDF. */
  fileObjectUrl: (id: string): Promise<string> =>
    fetchObjectUrl(`/documents/${id}/download`),
};

/** API-Client für die Ordnerverwaltung innerhalb des Dokumenten-Systems. */
export const documentFoldersApi = {
  /** GET /document-folders – Listet alle Ordner einer Entität. */
  list: (entityType: string, entityId: string): Promise<DocumentFolder[]> =>
    apiClient.get<DocumentFolder[]>(
      `/document-folders?entityType=${encodeURIComponent(
        entityType,
      )}&entityId=${encodeURIComponent(entityId)}`,
    ),

  /** Ordner erstellen. */
  create: (body: {
    entityType: string;
    entityId: string;
    name: string;
    parentId?: string;
    sortOrder?: number;
  }): Promise<DocumentFolder> =>
    apiClient.post<DocumentFolder>('/document-folders', body),

  /** Ordner umbenennen / sortieren. */
  update: (
    id: string,
    body: { name?: string; sortOrder?: number },
  ): Promise<DocumentFolder> =>
    apiClient.patch<DocumentFolder>(`/document-folders/${id}`, body),

  /** Ordner löschen (nur wenn leer). */
  remove: (id: string): Promise<unknown> =>
    apiClient.delete<unknown>(`/document-folders/${id}`),
};
