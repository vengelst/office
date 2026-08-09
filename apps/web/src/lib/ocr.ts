/**
 * API-Helfer für OCR- und Visitenkarten-Erkennung.
 */

import { TOKEN_STORAGE_KEY } from './api-client';
import type { ApiErrorResponse } from '@office/types';
import { ApiError } from './api-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

/**
 * Typ/Interface `BusinessCardField` für die Web-App.
 */
export interface BusinessCardField {
  value: string | null;
  confidence: number;
}

/**
 * Typ/Interface `BusinessCardData` für die Web-App.
 */
export interface BusinessCardData {
  firstName: BusinessCardField;
  lastName: BusinessCardField;
  title: BusinessCardField;
  role: BusinessCardField;
  department: BusinessCardField;
  company: BusinessCardField;
  email: BusinessCardField;
  phoneMobile: BusinessCardField;
  phoneLandline: BusinessCardField;
  addressLine1: BusinessCardField;
  postalCode: BusinessCardField;
  city: BusinessCardField;
  country: BusinessCardField;
  website: BusinessCardField;
  linkedInUrl: BusinessCardField;
}

async function ocrFetch<T>(path: string, body: FormData): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const payload = (data as ApiErrorResponse | null) ?? undefined;
    const message = payload
      ? Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message
      : `OCR fehlgeschlagen (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }

  return data as T;
}

/**
 * API-/UI-Helfer `scanBusinessCard` (scan Business Card).
 *
 * @param file - Datei/Upload (File)
 * @returns BusinessCardData
 */
export async function scanBusinessCard(file: File): Promise<BusinessCardData> {
  const form = new FormData();
  form.append('file', file);
  return ocrFetch<BusinessCardData>('/ocr/business-card', form);
}

/**
 * API-/UI-Helfer `scanBusinessCardFromDocument` (scan Business Card From Document).
 *
 * @param documentId - Parameter `documentId` (string)
 * @returns BusinessCardData
 */
export async function scanBusinessCardFromDocument(
  documentId: string,
): Promise<BusinessCardData> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;

  const res = await fetch(
    `${API_BASE_URL}/ocr/business-card/from-document/${documentId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const payload = (data as ApiErrorResponse | null) ?? undefined;
    const message = payload
      ? Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message
      : `OCR fehlgeschlagen (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }

  return data as BusinessCardData;
}
