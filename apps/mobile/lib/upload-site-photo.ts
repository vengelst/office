/**
 * Baustellenfoto-Upload über expo-file-system (Multipart).
 * Zuverlässiger als RN-`fetch`+FormData mit Fake-Blob auf Android.
 */

import {
  uploadAsync,
  FileSystemUploadType,
} from 'expo-file-system/legacy';
import {
  API_BASE_URL,
  ApiError,
  getToken,
} from './api';

export type SitePhotoUploadInput = {
  uri: string;
  mimeType?: string | null;
  workerId: string;
  projectId: string;
  comment?: string;
  commentX?: number | null;
  commentY?: number | null;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (typeof rec.message === 'string' && rec.message.trim()) {
      return rec.message;
    }
    if (Array.isArray(rec.message) && rec.message.length > 0) {
      return String(rec.message[0]);
    }
  }
  return `Upload fehlgeschlagen (${status})`;
}

/** Lädt ein Arbeitsfoto inkl. optionalem Kommentar / Position / GPS. */
export async function uploadSitePhoto(
  input: SitePhotoUploadInput,
): Promise<unknown> {
  const token = await getToken();
  const parameters: Record<string, string> = {
    workerId: input.workerId,
    projectId: input.projectId,
  };

  const comment = input.comment?.trim();
  if (comment) parameters.comment = comment;

  if (
    input.commentX != null &&
    input.commentY != null &&
    Number.isFinite(input.commentX) &&
    Number.isFinite(input.commentY)
  ) {
    parameters.commentX = String(input.commentX);
    parameters.commentY = String(input.commentY);
  }

  if (input.latitude != null && Number.isFinite(input.latitude)) {
    parameters.latitude = String(input.latitude);
  }
  if (input.longitude != null && Number.isFinite(input.longitude)) {
    parameters.longitude = String(input.longitude);
  }
  if (input.accuracy != null && Number.isFinite(input.accuracy)) {
    parameters.accuracy = String(input.accuracy);
  }

  const mimeType =
    input.mimeType && /^image\//i.test(input.mimeType)
      ? input.mimeType
      : 'image/jpeg';

  const result = await uploadAsync(
    `${API_BASE_URL}/time-entries/upload-photo`,
    input.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      parameters,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );

  let data: unknown = null;
  try {
    data = result.body ? JSON.parse(result.body) : null;
  } catch {
    data = result.body || null;
  }

  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(extractErrorMessage(data, result.status), result.status);
  }

  return data;
}
