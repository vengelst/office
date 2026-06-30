/** Multipart-Upload für Dokumente (apiClient kann nur JSON). */
import { ApiError, TOKEN_STORAGE_KEY } from './api-client';
import type { ApiErrorResponse } from '@office/types';
import type { DocumentItem } from './customers';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export interface UploadParams {
  file: File;
  documentType: string;
  title?: string;
  description?: string;
  entityType?: string;
  entityId?: string;
}

/** Lädt eine Datei per FormData zum Documents-Endpoint hoch. */
export async function uploadDocument(
  params: UploadParams,
): Promise<DocumentItem> {
  const form = new FormData();
  form.append('file', params.file);
  form.append('documentType', params.documentType);
  if (params.title) form.append('title', params.title);
  if (params.description) form.append('description', params.description);
  if (params.entityType) form.append('entityType', params.entityType);
  if (params.entityId) form.append('entityId', params.entityId);

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;

  const res = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const payload = (data as ApiErrorResponse | null) ?? undefined;
    const message = payload
      ? Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message
      : `Upload fehlgeschlagen (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }

  return data as DocumentItem;
}

/** Erzeugt eine Download-URL (mit Token als Query, da <a> keine Header sendet). */
export function downloadDocument(id: string): void {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;
  // Auth via Header ist bei direkten Navigationsdownloads nicht möglich –
  // daher per fetch laden und als Blob speichern.
  void fetch(`${API_BASE_URL}/documents/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('download failed');
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match ? decodeURIComponent(match[1]) : `dokument-${id}`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    })
    .catch(() => undefined);
}
