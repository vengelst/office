/**
 * API-Client für den Kunden-PL-Kiosk (PIN-Flow).
 */

import type {
  CustomerPlBoardResponse,
  CustomerPlProject,
  WorkItemDetail,
  WorkItemListParams,
  WorkItemReviewResult,
} from './work-items';

export const KIOSK_PL_TOKEN_KEY = 'office_kiosk_pl_token';
export const KIOSK_PL_USER_KEY = 'office_kiosk_pl_user';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

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

/** JSON-Fetch mit Kiosk-PL-Bearer-Token. */
export async function kioskPlFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem(KIOSK_PL_TOKEN_KEY)
      : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: string }).message)
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

/** Foto-Stream als Object-URL (Aufrufer revoket). */
async function photoObjectUrl(
  itemId: string,
  documentId: string,
): Promise<string> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem(KIOSK_PL_TOKEN_KEY)
      : null;
  const res = await fetch(
    `${API_BASE_URL}/pl/work-items/${itemId}/photos/${documentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  if (!res.ok) {
    throw new Error(`Foto konnte nicht geladen werden (${res.status})`);
  }
  return URL.createObjectURL(await res.blob());
}

/** Kiosk-PL-Client: Board, Detail, Fotos, Approve, Force-Complete. */
export const kioskPlApi = {
  projects: (): Promise<CustomerPlProject[]> =>
    kioskPlFetch<CustomerPlProject[]>('/pl/projects'),

  workItems: (
    projectId: string,
    params: WorkItemListParams = {},
  ): Promise<CustomerPlBoardResponse> =>
    kioskPlFetch<CustomerPlBoardResponse>(
      `/pl/projects/${projectId}/work-items${boardQuery(params)}`,
    ),

  workItem: (id: string): Promise<WorkItemDetail> =>
    kioskPlFetch<WorkItemDetail>(`/pl/work-items/${id}`),

  photoObjectUrl,

  approve: (id: string, comment?: string): Promise<WorkItemReviewResult> =>
    kioskPlFetch<WorkItemReviewResult>(`/work-items/${id}/reviews/approve`, {
      method: 'POST',
      body: { comment },
    }),

  forceComplete: (
    id: string,
    comment?: string,
  ): Promise<WorkItemReviewResult> =>
    kioskPlFetch<WorkItemReviewResult>(
      `/work-items/${id}/reviews/force-complete`,
      { method: 'POST', body: { comment } },
    ),
};
