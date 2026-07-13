import * as SecureStore from 'expo-secure-store';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3801/api';

const TOKEN_KEY = 'worker_token';
const WORKER_KEY = 'worker_data';

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

export interface LoginResponse {
  token: string;
  user: WorkerMe;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
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

async function apiFetch<T>(
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
    const msg =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: string }).message)
        : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
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

  clockIn: (body: ClockInBody) =>
    apiFetch<ClockStatus>('/time-entries/clock-in', { method: 'POST', body }),

  clockOut: (body: ClockOutBody) =>
    apiFetch<ClockStatus>('/time-entries/clock-out', { method: 'POST', body }),

  uploadPhoto: async (form: FormData) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE_URL}/time-entries/upload-photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    if (!res.ok)
      throw new ApiError(`Upload failed (${res.status})`, res.status);
    return res.json();
  },
};
