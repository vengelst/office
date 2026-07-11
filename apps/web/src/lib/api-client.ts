/**
 * Zentraler API-Client für die Office-App.
 * Stellt typisierte HTTP-Methoden (GET, POST, PATCH, DELETE) bereit,
 * setzt automatisch JWT-Token und JSON-Header und leitet bei 401 zum Login weiter.
 */
import type { ApiErrorResponse } from '@office/types';

/** Basis-URL der Backend-API (aus Umgebungsvariable oder Fallback auf localhost). */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

/** LocalStorage-Schlüssel für das Office-JWT. */
export const TOKEN_STORAGE_KEY = 'office_token';
const USER_STORAGE_KEY = 'office_user';

/** Strukturierter API-Fehler mit HTTP-Status und Server-Message. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly payload?: ApiErrorResponse;

  constructor(message: string, statusCode: number, payload?: ApiErrorResponse) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

/** Liest das Office-JWT aus dem LocalStorage (null bei SSR oder fehlendem Token). */
function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Entfernt abgelaufene/ungültige Auth-Daten und leitet zum Login weiter.
 * Wird aufgerufen, wenn die API 401 zurückgibt (Token abgelaufen o.ä.).
 */
function handleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.location.href = '/login';
}

/** Optionen für API-Anfragen (erweitert RequestInit um skipAuth-Flag). */
interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Wenn true, wird kein Authorization-Header gesetzt (z. B. für Login-Requests). */
  skipAuth?: boolean;
}

/**
 * Zentraler Fetch-Wrapper: setzt JSON-Header, JWT und parst Antworten/Fehler.
 * Bei 401 (und skipAuth=false) wird automatisch zum Login weitergeleitet.
 *
 * @param path - API-Pfad (ohne Basis-URL, z. B. "/customers")
 * @param options - HTTP-Methode, Body und weitere Optionen
 * @returns Deserialisierte JSON-Antwort
 * @throws ApiError bei nicht-erfolgreichen HTTP-Statuscodes
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json');
  const data: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      handleUnauthorized();
    }

    const payload = (data as ApiErrorResponse | null) ?? undefined;
    const message = payload
      ? Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message
      : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  return data as T;
}

/**
 * Upload-Wrapper für FormData (multipart/form-data).
 * Setzt keinen Content-Type-Header (wird automatisch vom Browser gesetzt).
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json');
  const data: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    const payload = (data as ApiErrorResponse | null) ?? undefined;
    const message = payload
      ? Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message
      : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  return data as T;
}

/** Typisierter API-Client mit Convenience-Methoden für alle HTTP-Verben. */
export const apiClient = {
  /** GET-Anfrage an den angegebenen API-Pfad. */
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  /** POST-Anfrage mit optionalem JSON-Body. */
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  /** PATCH-Anfrage für partielle Updates. */
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  /** DELETE-Anfrage zum Entfernen einer Ressource. */
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
