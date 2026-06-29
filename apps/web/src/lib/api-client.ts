import type { ApiErrorResponse } from '@office/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export const TOKEN_STORAGE_KEY = 'office_token';

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

function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Wenn true, wird kein Authorization-Header gesetzt. */
  skipAuth?: boolean;
}

/** Zentraler Fetch-Wrapper: setzt JSON-Header, JWT und parst Antworten/Fehler. */
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

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
