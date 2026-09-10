import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3801/api';

const TOKEN_KEY = 'worker_token';
const WORKER_KEY = 'worker_data';

export type BillingMode = 'HOURLY_PACKAGE' | 'UNIT_BASED' | 'MIXED';

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
    /** Projekt arbeitet item-basiert → Arbeitsitems-Bereich anbieten. */
    itemBased?: boolean;
    /** Abrechnungsart – steuert Tätigkeits-Select (#34 / #36). */
    billingMode?: BillingMode | null;
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
  /** Master-Monteur: Tätigkeiten immer pflichtig. */
  masterEngineer?: boolean;
  assignments: WorkerMeAssignment[];
}

export interface ClockProject {
  id: string;
  projectNumber: string;
  title: string;
  billingMode?: BillingMode | null;
}

export interface ClockStatus {
  clockedIn: boolean;
  since: string | null;
  durationMinutes: number;
  project: ClockProject | null;
  timeEntryId: string | null;
  lastGrossMinutes?: number;
  currentActivity?: {
    id: string;
    code: string;
    name: string;
    segmentId: string;
    startedAt: string;
    projectWorkActivityId?: string | null;
  } | null;
  currentWorkActivity?: {
    id: string;
    label: string;
    segmentId: string;
    startedAt: string;
  } | null;
  workActivities?: Array<{ id: string; label: string }>;
  onBreak?: boolean;
  breakStartedAt?: string | null;
  workDocumentationRequired?: boolean;
  workNotesEnabled?: boolean;
  workActivities?: Array<{ id: string; label: string }>;
  clockOutTimeEntryId?: string | null;
  pendingWorkDocumentation?: PendingWorkDocumentation | null;
}

export interface PendingWorkDocumentation {
  timeEntryId: string;
  projectId: string;
  workNotesEnabled: boolean;
  workActivities: Array<{ id: string; label: string }>;
  configurationError: boolean;
}

export interface WorkDocumentationBody {
  projectWorkActivityIds: string[];
  workNotes?: string;
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

/** Live-Anwesenheit scoped (GET /time-entries/live/scoped) – analog Web ScopedLiveEntry. */
export interface ScopedLiveEntry {
  worker: {
    id: string;
    workerNumber: string;
    firstName: string;
    lastName: string;
    photoPath: string | null;
  };
  project: (ClockProject & {
    customer?: { id: string; companyName: string };
  }) | null;
  since: string;
  durationMinutes: number;
  timeEntryId: string;
  activity?: { id: string; code: string; name: string } | null;
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
  activityTypeId?: string;
  projectWorkActivityId?: string;
  customWorkLabel?: string;
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

export interface BreakBody {
  workerId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  occurredAtClient?: string;
  comment?: string;
  sourceDevice?: string;
}

export interface SwitchActivityBody {
  workerId: string;
  activityTypeId?: string;
  projectWorkActivityId?: string;
  customWorkLabel?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  occurredAtClient?: string;
}

export interface ProjectWorkActivityItem {
  id: string;
  label: string;
  active?: boolean;
}

export interface ActivityTypeItem {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  billable: boolean;
}

export interface GeoPingBody {
  workerId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  projectId?: string;
  eventType?: 'MANUAL' | 'LOGIN' | 'LOGOUT' | 'PHOTO' | 'ACTION';
}

export interface KioskPublicSettings {
  gpsIntervalMinutes?: number;
  pinLength?: number;
}

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
}

export interface TimesheetSignature {
  id: string;
  weeklyTimesheetId: string;
  signerType: string;
  signerName: string;
  signerRole: string | null;
  signatureImagePath: string;
  signedAt: string;
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
  rejectedAt: string | null;
  rejectionReason: string | null;
  worker: {
    id: string;
    workerNumber: string;
    firstName: string;
    lastName: string;
    photoPath: string | null;
  };
  project: ClockProject & {
    customer?: { id: string; companyName: string } | null;
  };
  days: TimesheetDay[];
  signatures: TimesheetSignature[];
}

/**
 * Antwort von `POST /worker-auth/pin-login`. Die API liefert das JWT als
 * `accessToken` und dazu nur den schlanken Auth-Benutzer – das vollständige
 * Monteur-Profil kommt danach über `GET /worker-auth/me`.
 */
export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    type: string;
    roles: string[];
    displayName: string;
  };
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function setWorkerSession(
  token: string,
  worker: WorkerMe,
): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(WORKER_KEY, JSON.stringify(worker));
}

export async function getStoredWorker(): Promise<WorkerMe | null> {
  const raw = await SecureStore.getItemAsync(WORKER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(WORKER_KEY);
}

export class ApiError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/** NestJS `message` kann String oder String[] sein. */
function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const raw = (data as { message: unknown }).message;
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map(String).join('\n');
    }
  }
  if (status === 409) {
    return 'Konflikt – Aktion nicht möglich (z. B. Stundenzettel gesperrt).';
  }
  return `Request failed (${status})`;
}

/**
 * JSON-Request gegen die API. Hängt automatisch das Worker-Token an
 * (außer `skipAuth`) und wirft bei Fehlern einen `ApiError` mit der
 * Server-Meldung – die Screens zeigen diese direkt an.
 */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; skipAuth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!options.skipAuth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(extractErrorMessage(data, res.status), res.status);
  }
  return data as T;
}

/**
 * Multipart-Request (Datei-Uploads). Setzt bewusst **keinen** Content-Type,
 * damit `fetch` die Boundary selbst ergänzt – analog `workerApi.uploadPhoto`.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(extractErrorMessage(data, res.status), res.status);
  }
  return data as T;
}

/** Nutzerfreundlicher Titel für Stempel-/API-Fehler (409 = Stempel-Lock). */
export function stampErrorTitle(err: unknown): string {
  if (err instanceof ApiError && err.statusCode === 409) {
    return 'Stempel gesperrt';
  }
  return 'Fehler';
}

export const workerApi = {
  pinLogin: (pin: string) =>
    apiFetch<LoginResponse>('/worker-auth/pin-login', {
      method: 'POST',
      body: { pin },
      skipAuth: true,
    }),

  me: () => apiFetch<WorkerMe>('/worker-auth/me'),

  logout: () =>
    apiFetch<{ success: true }>('/worker-auth/logout', { method: 'POST' }),

  status: (workerId: string) =>
    apiFetch<ClockStatus>(`/time-entries/status/${workerId}`),

  today: (workerId: string) =>
    apiFetch<TodayEntry[]>(`/time-entries/today/${workerId}`),

  /**
   * GET /time-entries/live/scoped – wer ist auf zugewiesenen Projekten eingestempelt (#38).
   * Optionaler projectId-Filter (aktuelles/gewähltes Projekt).
   */
  liveScoped: (projectId?: string) => {
    const q = projectId
      ? `?projectId=${encodeURIComponent(projectId)}`
      : '';
    return apiFetch<ScopedLiveEntry[]>(`/time-entries/live/scoped${q}`);
  },

  clockIn: (body: ClockInBody) =>
    apiFetch<ClockStatus>('/time-entries/clock-in', { method: 'POST', body }),

  clockOut: (body: ClockOutBody) =>
    apiFetch<ClockStatus>('/time-entries/clock-out', { method: 'POST', body }),

  breakStart: (body: BreakBody) =>
    apiFetch<ClockStatus>('/time-entries/break-start', {
      method: 'POST',
      body,
    }),

  breakEnd: (body: BreakBody) =>
    apiFetch<ClockStatus>('/time-entries/break-end', {
      method: 'POST',
      body,
    }),

  switchActivity: (body: SwitchActivityBody) =>
    apiFetch<ClockStatus>('/time-entries/switch-activity', {
      method: 'POST',
      body,
    }),

  listActivityTypes: () =>
    apiFetch<ActivityTypeItem[]>('/activity-types?active=true'),
  listWorkActivities: (projectId: string) =>
    apiFetch<ProjectWorkActivityItem[]>(
      `/projects/${projectId}/work-activities`,
    ),

  gpsPing: (body: GeoPingBody) =>
    apiFetch<unknown>('/time-entries/gps-ping', { method: 'POST', body }),

  getPublicKioskSettings: () =>
    apiFetch<KioskPublicSettings>('/kiosk-settings/public', { skipAuth: true }),

  saveWorkDocumentation: (timeEntryId: string, body: WorkDocumentationBody) =>
    apiFetch<unknown>(`/time-entries/${timeEntryId}/work-documentation`, {
      method: 'POST',
      body,
    }),

  listTimesheets: (params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.sortBy) q.set('sortBy', params.sortBy);
    if (params?.sortDir) q.set('sortDir', params.sortDir);
    const qs = q.toString();
    return apiFetch<TimesheetListResponse>(
      `/timesheets${qs ? `?${qs}` : ''}`,
    );
  },

  getTimesheet: (id: string) =>
    apiFetch<TimesheetDetail>(`/timesheets/${id}`),

  signTimesheet: (
    id: string,
    body: {
      signerType: 'WORKER';
      signerName: string;
      signerRole?: string;
      signatureBase64: string;
    },
  ) =>
    apiFetch<TimesheetDetail>(`/timesheets/${id}/sign`, {
      method: 'POST',
      body,
    }),

  uploadPhoto: async (form: FormData) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE_URL}/time-entries/upload-photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    if (!res.ok) {
      const isJson = res.headers
        .get('content-type')
        ?.includes('application/json');
      const data: unknown = isJson ? await res.json() : null;
      throw new ApiError(extractErrorMessage(data, res.status), res.status);
    }
    return res.json();
  },
};
