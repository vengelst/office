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

/** Lebenszyklus-Status eines Wochenstundenzettels (Entwurf → Eingereicht → Genehmigt → Archiviert). */
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

/** Rolle des Unterzeichners bei einer Stundenzettel-Signatur. */
export type SignerType = 'WORKER' | 'CUSTOMER' | 'SUPERVISOR' | 'MANAGER';

/** Geltungsbereich einer Pausenregel: global oder projektspezifisch. */
export type BreakScopeType = 'GLOBAL' | 'PROJECT';

// ── Monteur-Profil (Worker-Token) ──────────────────────────────

/** Projektzuordnung im Monteur-Profil (für die Monteur-App). */
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

/** Eigenes Profil des eingeloggten Monteurs (über Worker-Token). */
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

/** Kompakte Projektdaten im Stempel-Kontext. */
export interface ClockProject {
  id: string;
  projectNumber: string;
  title: string;
}

/** Aktueller Stempel-Status eines Monteurs (eingestempelt, Projekt, Dauer). */
export interface ClockStatus {
  clockedIn: boolean;
  since: string | null;
  durationMinutes: number;
  project: ClockProject | null;
  timeEntryId: string | null;
  /** Nur bei clock-out: Brutto-Minuten des gerade beendeten Intervalls. */
  lastGrossMinutes?: number;
}

/** Einzelner Stempel-Eintrag des heutigen Tages. */
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

/** Live-Eintrag eines gerade eingestempelten Monteurs (für die Büro-Übersicht). */
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

/** Request-Body zum Einstempeln eines Monteurs. */
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

/** Request-Body zum Ausstempeln eines Monteurs. */
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

/** Kompakte Darstellung eines Wochenstundenzettels für Listenansichten. */
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

/** Paginierte Antwort der Stundenzettel-Liste. */
export interface TimesheetListResponse {
  data: TimesheetListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Einzelner Tag eines Wochenstundenzettels (Arbeitszeiten, Pausen, GPS). */
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

/** Digitale Signatur auf einem Wochenstundenzettel (Monteur, Kunde, Vorgesetzter). */
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

/** Vollständiger Wochenstundenzettel mit Tagen, Signaturen und verknüpftem Projekt/Monteur. */
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

/** Filter-, Paginierungs- und Sortierparameter für die Stundenzettel-Liste. */
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

/** Request-Body zum Generieren eines Wochenstundenzettels aus Zeiteinträgen. */
export interface GenerateTimesheetBody {
  workerId: string;
  projectId: string;
  weekYear: number;
  weekNumber: number;
}

/** Request-Body zum Aktualisieren eines einzelnen Stundenzettel-Tages. */
export interface UpdateDayBody {
  firstClockInAt?: string;
  lastClockOutAt?: string;
  breakMinutes?: number;
  summaryComment?: string;
}

/** Request-Body zum digitalen Signieren eines Stundenzettels. */
export interface SignBody {
  signerType: SignerType;
  signerName: string;
  signerRole?: string;
  signatureBase64: string;
}

// ── Pausenregeln ───────────────────────────────────────────────

/** Pausenregel mit Schwellwerten und automatischem Abzug (global oder projektspezifisch). */
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

/** Request-Body zum Anlegen/Aktualisieren einer Pausenregel. */
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

/** LocalStorage-Schlüssel für das Worker-JWT. */
export const WORKER_TOKEN_KEY = 'office_worker_token';

/** LocalStorage-Schlüssel für die serialisierten Worker-Profildaten. */
export const WORKER_USER_KEY = 'office_worker';

/** Liest das Worker-JWT aus dem LocalStorage (null wenn nicht vorhanden oder SSR). */
export function getWorkerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(WORKER_TOKEN_KEY);
}

/**
 * Speichert Worker-Token und Profil im LocalStorage nach erfolgreicher PIN-Anmeldung.
 * @param token - JWT für Worker-Endpoints
 * @param worker - Monteur-Profil aus der Login-Antwort
 */
export function setWorkerSession(token: string, worker: WorkerMe): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WORKER_TOKEN_KEY, token);
  window.localStorage.setItem(WORKER_USER_KEY, JSON.stringify(worker));
}

/** Liest das gespeicherte Worker-Profil aus dem LocalStorage (null wenn nicht vorhanden). */
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

/** Entfernt Worker-Token und Profil aus dem LocalStorage (Abmeldung). */
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

/** API-Client für die Monteur-App (PIN-Login, Stempeln, Foto-Upload). Nutzt Worker-Token. */
export const workerApi = {
  /**
   * POST /worker-auth/pin-login – Authentifiziert einen Monteur per PIN.
   * @param pin - 4–6-stellige PIN
   * @returns JWT-Token und Monteur-Profil
   */
  async pinLogin(pin: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>(
      '/worker-auth/pin-login',
      { pin },
      { skipAuth: true },
    );
  },
  /** GET /worker-auth/me – Lädt das eigene Monteur-Profil. */
  me: () => workerFetch<WorkerMe>('/worker-auth/me'),
  /** POST /worker-auth/logout – Meldet den Monteur ab und invalidiert das Token. */
  logout: () =>
    workerFetch<{ success: true }>('/worker-auth/logout', { method: 'POST' }),

  /**
   * GET /time-entries/status/:workerId – Aktueller Stempel-Status eines Monteurs.
   * @param workerId - Monteur-ID
   */
  status: (workerId: string) =>
    workerFetch<ClockStatus>(`/time-entries/status/${workerId}`),
  /**
   * GET /time-entries/today/:workerId – Alle Stempel-Einträge des heutigen Tages.
   * @param workerId - Monteur-ID
   */
  today: (workerId: string) =>
    workerFetch<TodayEntry[]>(`/time-entries/today/${workerId}`),
  /**
   * POST /time-entries/clock-in – Stempelt einen Monteur auf ein Projekt ein.
   * @param body - Monteur-ID, Projekt-ID und optionale GPS-Koordinaten
   */
  clockIn: (body: ClockInBody) =>
    workerFetch<ClockStatus>('/time-entries/clock-in', {
      method: 'POST',
      body,
    }),
  /**
   * POST /time-entries/clock-out – Stempelt einen Monteur aus.
   * @param body - Monteur-ID und optionale GPS-Koordinaten
   */
  clockOut: (body: ClockOutBody) =>
    workerFetch<ClockStatus>('/time-entries/clock-out', {
      method: 'POST',
      body,
    }),
  /**
   * POST /time-entries/upload-photo – Lädt ein Arbeitsfoto hoch.
   * @param form - FormData mit Bilddatei
   */
  uploadPhoto: (form: FormData) =>
    workerUpload<unknown>('/time-entries/upload-photo', form),
};

// ──────────────────────────────────────────────────────────────
// Office-API (Office-Token via apiClient)
// ──────────────────────────────────────────────────────────────

/** API-Client für die Live-Zeiterfassungsübersicht im Büro (Office-Token). */
export const timeEntriesApi = {
  /**
   * GET /time-entries/live – Listet alle aktuell eingestempelten Monteure.
   * @returns Liste der Live-Einträge mit Monteur, Projekt und Dauer
   */
  live: () => apiClient.get<LiveEntry[]>('/time-entries/live'),
};

/** API-Client für Wochenstundenzettel (CRUD, Workflow, Signatur, PDF). */
export const timesheetsApi = {
  /**
   * GET /timesheets – Listet Stundenzettel paginiert mit optionalen Filtern.
   * @param params - Filter (Monteur, Projekt, KW, Status) + Paginierung
   * @returns Paginierte Stundenzettel-Liste
   */
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
  /**
   * GET /timesheets/:id – Lädt einen einzelnen Stundenzettel mit Tagen und Signaturen.
   * @param id - Stundenzettel-ID
   */
  get: (id: string) => apiClient.get<TimesheetDetail>(`/timesheets/${id}`),
  /**
   * POST /timesheets/generate – Generiert einen Stundenzettel aus Zeiteinträgen.
   * @param body - Monteur, Projekt, Kalenderwoche
   */
  generate: (body: GenerateTimesheetBody) =>
    apiClient.post<TimesheetDetail>('/timesheets/generate', body),
  /**
   * PATCH /timesheets/:id/days/:dayId – Aktualisiert einen einzelnen Tag.
   * @param id - Stundenzettel-ID
   * @param dayId - Tages-ID
   * @param body - Zu aktualisierende Felder (Zeiten, Pausen, Kommentar)
   */
  updateDay: (id: string, dayId: string, body: UpdateDayBody) =>
    apiClient.patch<TimesheetDetail>(
      `/timesheets/${id}/days/${dayId}`,
      body,
    ),
  /**
   * POST /timesheets/:id/submit – Reicht den Stundenzettel zur Prüfung ein.
   * @param id - Stundenzettel-ID
   */
  submit: (id: string) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/submit`),
  /**
   * POST /timesheets/:id/approve – Genehmigt den Stundenzettel.
   * @param id - Stundenzettel-ID
   */
  approve: (id: string) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/approve`),
  /**
   * POST /timesheets/:id/archive – Archiviert den Stundenzettel.
   * @param id - Stundenzettel-ID
   */
  archive: (id: string) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/archive`),
  /**
   * POST /timesheets/:id/reject – Lehnt den Stundenzettel ab.
   * @param id - Stundenzettel-ID
   * @param reason - Begründung der Ablehnung
   */
  reject: (id: string, reason: string) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/reject`, { reason }),
  /**
   * POST /timesheets/:id/sign – Signiert den Stundenzettel digital.
   * @param id - Stundenzettel-ID
   * @param body - Signaturtyp, Name und Base64-Bild der Unterschrift
   */
  sign: (id: string, body: SignBody) =>
    apiClient.post<TimesheetDetail>(`/timesheets/${id}/sign`, body),
  /**
   * Erzeugt die URL zum Stundenzettel-PDF (für direkten Download).
   * @param id - Stundenzettel-ID
   */
  pdfUrl: (id: string) => `${API_BASE_URL}/timesheets/${id}/pdf`,
};

/** API-Client für Pausenregeln-Verwaltung (CRUD). */
export const breakRulesApi = {
  /**
   * GET /break-rules – Listet Pausenregeln, optional gefiltert nach Projekt.
   * @param projectId - Optionale Projekt-ID für projektspezifische Regeln
   * @returns Liste aller zutreffenden Pausenregeln
   */
  list(projectId?: string): Promise<BreakRuleItem[]> {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return apiClient.get<BreakRuleItem[]>(`/break-rules${q}`);
  },
  /**
   * POST /break-rules – Erstellt eine neue Pausenregel.
   * @param body - Regeldetails (Schwellwerte, Abzüge, Geltungsbereich)
   */
  create: (body: BreakRuleBody) =>
    apiClient.post<BreakRuleItem>('/break-rules', body),
  /**
   * PATCH /break-rules/:id – Aktualisiert eine bestehende Pausenregel.
   * @param id - Pausenregel-ID
   * @param body - Zu aktualisierende Felder
   */
  update: (id: string, body: Partial<BreakRuleBody>) =>
    apiClient.patch<BreakRuleItem>(`/break-rules/${id}`, body),
  /**
   * DELETE /break-rules/:id – Löscht eine Pausenregel.
   * @param id - Pausenregel-ID
   */
  remove: (id: string) =>
    apiClient.delete<unknown>(`/break-rules/${id}`),
};

// ──────────────────────────────────────────────────────────────
// Kiosk-API (Worker-Token, projekt-gebunden)
// ──────────────────────────────────────────────────────────────

/** Stempel-Status eines Monteurs in der Kiosk-Ansicht. */
export interface KioskWorkerStatus {
  workerId: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  clockedIn: boolean;
  since: string | null;
}

/** API-Client für den Kiosk-Modus (Projekt-Tablet für Ein-/Ausstempeln aller Monteure). */
export const kioskApi = {
  /**
   * POST /worker-auth/pin-login – PIN-Login im Kiosk-Modus.
   * @param pin - 4–6-stellige Monteur-PIN
   */
  pinLogin: (pin: string) => workerApi.pinLogin(pin),
  /** GET /worker-auth/me – Lädt das Monteur-Profil im Kiosk-Kontext. */
  me: () => workerFetch<WorkerMe>('/worker-auth/me'),
  /**
   * GET /time-entries/status/:workerId – Stempel-Status im Kiosk.
   * @param workerId - Monteur-ID
   */
  status: (workerId: string) =>
    workerFetch<ClockStatus>(`/time-entries/status/${workerId}`),
  /**
   * POST /time-entries/clock-in – Stempelt einen Monteur im Kiosk ein.
   * @param body - Monteur-ID und Projekt-ID
   */
  clockIn: (body: ClockInBody) =>
    workerFetch<ClockStatus>('/time-entries/clock-in', {
      method: 'POST',
      body,
    }),
  /**
   * POST /time-entries/clock-out – Stempelt einen Monteur im Kiosk aus.
   * @param body - Monteur-ID
   */
  clockOut: (body: ClockOutBody) =>
    workerFetch<ClockStatus & { lastGrossMinutes?: number }>('/time-entries/clock-out', {
      method: 'POST',
      body,
    }),
  /**
   * GET /time-entries/project-status/:projectId – Status aller Monteure eines Projekts.
   * @param projectId - Projekt-ID
   * @returns Ein-/Ausgestempelt-Status aller zugeordneten Monteure
   */
  projectStatus: (projectId: string) =>
    workerFetch<KioskWorkerStatus[]>(`/time-entries/project-status/${projectId}`),
  /**
   * POST /time-entries/upload-photo – Lädt ein Arbeitsfoto im Kiosk-Modus hoch.
   * @param form - FormData mit Bilddatei
   */
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

/**
 * Berechnet ISO-Kalenderwoche und -Jahr eines Datums.
 * Nützlich für die Default-Werte im Stundenzettel-Generieren-Dialog.
 * @param date - Eingabedatum
 * @returns weekYear und weekNumber nach ISO 8601
 */
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
