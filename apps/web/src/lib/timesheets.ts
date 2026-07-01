/**
 * Typen und API-Funktionen für die Zeiterfassung:
 * - Monteur-App (PIN-Login + Stempeln) mit eigenem Worker-Token
 * - Live-Übersicht, Wochenstundenzettel und Pausenregeln (Office-Token)
 *
 * Die Monteur-App nutzt einen separaten Token-Speicher, damit sie eine
 * Office-Session nicht überschreibt und 401 zur PIN-Seite (statt /login) führt.
 */
import { ApiError, apiClient } from './api-client';
import type { ApiErrorResponse, LoginResponse } from '@office/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

// ── Enums (spiegeln Prisma) ────────────────────────────────────

export type WeeklyTimesheetStatus =
  | 'DRAFT'
  | 'WORKER_SIGNED'
  | 'CUSTOMER_SIGNED'
  | 'COMPLETED'
  | 'LOCKED'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

export type SignerType = 'WORKER' | 'CUSTOMER' | 'SUPERVISOR' | 'MANAGER';
export type BreakScopeType = 'GLOBAL' | 'PROJECT';

// ── Monteur-Profil (Worker-Token) ──────────────────────────────

export interface WorkerMeAssignment {
  id: string;
  startDate: string;
  endDate: string | null;
  isLead: boolean;
  roleName: string | null;
  project: {
    id: string;
    projectNumber: string;
    title: string;
    customer: { companyName: string } | null;
  };
}

export interface WorkerMe {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  photoPath: string | null;
  availability: string;
  assignments: WorkerMeAssignment[];
}

// ── Stempel-Status / Einträge ──────────────────────────────────

export interface ClockProject {
  id: string;
  projectNumber: string;
  title: string;
}

export interface ClockStatus {
  clockedIn: boolean;
  since: string | null;
  durationMinutes: number;
  project: ClockProject | null;
  timeEntryId: string | null;
  /** Nur bei clock-out: Brutto-Minuten des gerade beendeten Intervalls. */
  lastGrossMinutes?: number;
}

export interface TodayEntry {
  id: string;
  entryType: string;
  occurredAtClient: string;
  occurredAtServer: string;
  latitude: number | null;
  longitude: number | null;
  comment: string | null;
  project: ClockProject;
}

export interface LiveEntry {
  worker: {
    id: string;
    workerNumber: string;
    firstName: string;
    lastName: string;
    photoPath: string | null;
  };
  project:
    | (ClockProject & { customer: { id: string; companyName: string } })
    | null;
  since: string;
  durationMinutes: number;
  timeEntryId: string;
}

export interface ClockInBody {
  workerId: string;
  projectId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  occurredAtClient?: string;
  comment?: string;
  sourceDevice?: string;
}

export interface ClockOutBody {
  workerId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  occurredAtClient?: string;
  comment?: string;
  sourceDevice?: string;
}

// ── Wochenstundenzettel ────────────────────────────────────────

export interface TimesheetListItem {
  id: string;
  weekYear: number;
  weekNumber: number;
  status: WeeklyTimesheetStatus;
  totalMinutesGross: number | null;
  totalBreakMinutes: number | null;
  totalMinutesNet: number | null;
  generatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  worker: {
    id: string;
    workerNumber: string;
    firstName: string;
    lastName: string;
  };
  project: ClockProject;
}

export interface TimesheetListResponse {
  data: TimesheetListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TimesheetDay {
  id: string;
  weeklyTimesheetId: string;
  workDate: string;
  firstClockInAt: string | null;
  lastClockOutAt: string | null;
  grossMinutes: number | null;
  breakMinutes: number | null;
  netMinutes: number | null;
  summaryComment: string | null;
  clockInLatitude: number | null;
  clockInLongitude: number | null;
  clockOutLatitude: number | null;
  clockOutLongitude: number | null;
}

export interface TimesheetSignature {
  id: string;
  weeklyTimesheetId: string;
  signerType: SignerType;
  signerName: string;
  signerRole: string | null;
  signatureImagePath: string;
  signedAt: string;
  ipAddress: string | null;
  deviceInfo: string | null;
}

export interface TimesheetDetail {
  id: string;
  workerId: string;
  projectId: string;
  weekYear: number;
  weekNumber: number;
  status: WeeklyTimesheetStatus;
  totalMinutesGross: number | null;
  totalBreakMinutes: number | null;
  totalMinutesNet: number | null;
  generatedAt: string;
  lockedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  reviewedByUserId: string | null;
  approvedByUserId: string | null;
  worker: {
    id: string;
    workerNumber: string;
    firstName: string;
    lastName: string;
    photoPath: string | null;
  };
  project: ClockProject & { customer: { id: string; companyName: string } };
  reviewedBy: { id: string; displayName: string } | null;
  approvedBy: { id: string; displayName: string } | null;
  days: TimesheetDay[];
  signatures: TimesheetSignature[];
}

export interface TimesheetListParams {
  page?: number;
  limit?: number;
  workerId?: string;
  projectId?: string;
  weekYear?: number;
  weekNumber?: number;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface GenerateTimesheetBody {
  workerId: string;
  projectId: string;
  weekYear: number;
  weekNumber: number;
}

export interface UpdateDayBody {
  firstClockInAt?: string;
  lastClockOutAt?: string;
  breakMinutes?: number;
  summaryComment?: string;
}

export interface SignBody {
  signerType: SignerType;
  signerName: string;
  signerRole?: string;
  signatureBase64: string;
}

// ── Pausenregeln ───────────────────────────────────────────────

export interface BreakRuleItem {
  id: string;
  scopeType: BreakScopeType;
  projectId: string | null;
  name: string;
  autoDeductEnabled: boolean;
  thresholdMinutes1: number;
  breakMinutes1: number;
  thresholdMinutes2: number | null;
  breakMinutes2: number | null;
  active: boolean;
  project: ClockProject | null;
}

export interface BreakRuleBody {
  scopeType: BreakScopeType;
  projectId?: string;
  name: string;
  autoDeductEnabled?: boolean;
  thresholdMinutes1: number;
  breakMinutes1: number;
  thresholdMinutes2?: number | null;
  breakMinutes2?: number | null;
  active?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Monteur-Token-Speicher (separat von der Office-Session)
// ──────────────────────────────────────────────────────────────

export const WORKER_TOKEN_KEY = 'office_worker_token';
export const WORKER_USER_KEY = 'office_worker';

export function getWorkerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(WORKER_TOKEN_KEY);
}

export function setWorkerSession(token: string, worker: WorkerMe): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WORKER_TOKEN_KEY, token);
  window.localStorage.setItem(WORKER_USER_KEY, JSON.stringify(worker));
}

export function getStoredWorker(): WorkerMe | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(WORKER_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkerMe;
  } catch {
    return null;
  }
}

export function clearWorkerSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(WORKER_TOKEN_KEY);
  window.localStorage.removeItem(WORKER_USER_KEY);
}

/** Fetch-Wrapper für Worker-Endpoints (eigenes Token, 401 → PIN-Seite). */
async function workerFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getWorkerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      clearWorkerSession();
      window.location.href = '/worker-app';
    }
    const payload = (data as ApiErrorResponse | null) ?? undefined;
    const message = payload
      ? Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message
      : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }
  return data as T;
}

/** Multipart-Upload (Arbeitsfoto) mit Worker-Token. */
async function workerUpload<T>(path: string, form: FormData): Promise<T> {
  const token = getWorkerToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
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
  return data as T;
}

// ──────────────────────────────────────────────────────────────
// Monteur-App-API (Worker-Token)
// ──────────────────────────────────────────────────────────────

export const workerApi = {
  /** PIN-Login (ohne Token). Gibt Token + Akteur zurück. */
  async pinLogin(pin: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>(
      '/worker-auth/pin-login',
      { pin },
      { skipAuth: true },
    );
  },
  me: () => workerFetch<WorkerMe>('/worker-auth/me'),
  logout: () =>
    workerFetch<{ success: true }>('/worker-auth/logout', { method: 'POST' }),

  status: (workerId: string) =>
    workerFetch<ClockStatus>(`/time-entries/status/${workerId}`),
  today: (workerId: string) =>
    workerFetch<TodayEntry[]>(`/time-entries/today/${workerId}`),
  clockIn: (body: ClockInBody) =>
    workerFetch<ClockStatus>('/time-entries/clock-in', {
      method: 'POST',
      body,
    }),
  clockOut: (body: ClockOutBody) =>
    workerFetch<ClockStatus>('/time-entries/clock-out', {
      method: 'POST',
      body,
    }),
  uploadPhoto: (form: FormData) =>
    workerUpload<unknown>('/time-entries/upload-photo', form),
};

// ──────────────────────────────────────────────────────────────
// Office-API (Office-Token via apiClient)
// ──────────────────────────────────────────────────────────────

export const timeEntriesApi = {
  live: () => apiClient.get<LiveEntry[]>('/time-entries/live'),
};

export const timesheetsApi = {
  list(params: TimesheetListParams): Promise<TimesheetListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.workerId) q.set('workerId', params.workerId);
    if (params.projectId) q.set('projectId', params.projectId);
    if (params.weekYear) q.set('weekYear', String(params.weekYear));
    if (params.weekNumber) q.set('weekNumber', String(params.weekNumber));
    if (params.status) q.set('status', params.status);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<TimesheetListResponse>(
      `/timesheets?${q.toString()}`,
    );
  },
  get: (id: string) => apiClient.get<TimesheetDetail>(`/timesheets/${id}`),
  generate: (body: GenerateTimesheetBody) =>
    apiClient.post<TimesheetDetail>('/timesheets/generate', body),
  updateDay: (id: string, dayId: string, body: UpdateDayBody) =>
    apiClient.patch<TimesheetDetail>(
      `/timesheets/${id}/days/${dayId}`,
      body,
    ),
  submit: (id: string) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/submit`),
  approve: (id: string) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/approve`),
  archive: (id: string) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/archive`),
  reject: (id: string, reason: string) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/reject`, { reason }),
  sign: (id: string, body: SignBody) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/sign`, body),
  pdfUrl: (id: string) => `${API_BASE_URL}/timesheets/${id}/pdf`,
};

export const breakRulesApi = {
  list(projectId?: string): Promise<BreakRuleItem[]> {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return apiClient.get<BreakRuleItem[]>(`/break-rules${q}`);
  },
  create: (body: BreakRuleBody) =>
    apiClient.post<BreakRuleItem>('/break-rules', body),
  update: (id: string, body: Partial<BreakRuleBody>) =>
    apiClient.patch<BreakRuleItem>(`/break-rules/${id}`, body),
  remove: (id: string) =>
    apiClient.delete<unknown>(`/break-rules/${id}`),
};

// ──────────────────────────────────────────────────────────────
// Kiosk-API (Worker-Token, projekt-gebunden)
// ──────────────────────────────────────────────────────────────

export interface KioskWorkerStatus {
  workerId: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  clockedIn: boolean;
  since: string | null;
}

export const kioskApi = {
  pinLogin: (pin: string) => workerApi.pinLogin(pin),
  me: () => workerFetch<WorkerMe>('/worker-auth/me'),
  status: (workerId: string) =>
    workerFetch<ClockStatus>(`/time-entries/status/${workerId}`),
  clockIn: (body: ClockInBody) =>
    workerFetch<ClockStatus>('/time-entries/clock-in', {
      method: 'POST',
      body,
    }),
  clockOut: (body: ClockOutBody) =>
    workerFetch<ClockStatus & { lastGrossMinutes?: number }>('/time-entries/clock-out', {
      method: 'POST',
      body,
    }),
  projectStatus: (projectId: string) =>
    workerFetch<KioskWorkerStatus[]>(`/time-entries/project-status/${projectId}`),
  uploadPhoto: (form: FormData) => workerUpload<unknown>('/time-entries/upload-photo', form),
};

// ── Helfer ─────────────────────────────────────────────────────

/** Lädt das Stundenzettel-PDF mit Office-Token und stößt den Download an. */
export async function downloadTimesheetPdf(
  id: string,
  filename: string,
): Promise<void> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('office_token')
      : null;
  const res = await fetch(timesheetsApi.pdfUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new ApiError(`PDF-Export fehlgeschlagen (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Minuten → "Hh Mm" (z. B. 510 → "8h 30m"). */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${`${m}`.padStart(2, '0')}m`;
}

/** Minuten → Dezimalstunden (z. B. 510 → "8,5 h"). */
export function formatHours(min: number | null | undefined): string {
  if (min == null) return '–';
  return `${(min / 60).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} h`;
}

/** Uhrzeit HH:MM aus ISO-String (lokal). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Datum TT.MM.JJJJ aus ISO-String (lokal). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('de-DE');
}

/** Sekunden → "H:MM:SS" für die Live-Timer-Anzeige. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${`${m}`.padStart(2, '0')}:${`${sec}`.padStart(2, '0')}`;
}

/** ISO-Kalenderwoche + Jahr eines Datums (für Generieren-Dialog-Defaults). */
export function isoWeekOf(date: Date): {
  weekYear: number;
  weekNumber: number;
} {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { weekYear: d.getUTCFullYear(), weekNumber };
}
