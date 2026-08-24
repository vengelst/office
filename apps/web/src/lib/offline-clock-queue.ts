/**
 * Offline-Stempel-Queue (Auftrag #13).
 *
 * Speichert Clock-In/Out in IndexedDB, wenn der Request fehlschlägt (Offline,
 * Timeout, Netzfehler), und synchronisiert FIFO bei Online/Focus/Intervall.
 * API-Idempotenz über `clientEventId` (UUID v4).
 *
 * Nicht-Ziele: Arbeitsitems, PIN-Login, PL-Kiosk, Background Sync API.
 */

import { ApiError } from './api-client';
import {
  getWorkerToken,
  type ClockInBody,
  type ClockOutBody,
  type ClockProject,
  type ClockStatus,
} from './timesheets';

const DB_NAME = 'office-offline-clock';
const DB_VERSION = 1;
const STORE = 'queue';
const SYNC_INTERVAL_MS = 45_000;
const REQUEST_TIMEOUT_MS = 20_000;

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

/**
 * Typ/Interface `OfflineClockType` für die Web-App.
 */
export type OfflineClockType = 'CLOCK_IN' | 'CLOCK_OUT';
/**
 * Typ/Interface `OfflineQueueItemStatus` für die Web-App.
 */
export type OfflineQueueItemStatus = 'pending' | 'syncing' | 'failed';

/**
 * Typ/Interface `OfflineClockGps` für die Web-App.
 */
export interface OfflineClockGps {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

/**
 * Typ/Interface `OfflineClockEntry` für die Web-App.
 */
export interface OfflineClockEntry {
  /** = clientEventId (UUID v4) */
  id: string;
  type: OfflineClockType;
  workerId: string;
  projectId: string;
  occurredAtClient: string;
  gps?: OfflineClockGps;
  sourceDevice?: string;
  comment?: string;
  /** Tätigkeitsbereich (Master Clock-In). */
  activityTypeId?: string;
  createdAt: string;
  status: OfflineQueueItemStatus;
  lastError?: string;
  /** Projekt-Snapshot für optimistischen UI-Status (nur CLOCK_IN). */
  projectSnapshot?: ClockProject | null;
}

/**
 * Typ/Interface `OfflineQueueSnapshot` für die Web-App.
 */
export interface OfflineQueueSnapshot {
  online: boolean;
  pendingCount: number;
  failedCount: number;
  entries: OfflineClockEntry[];
  /** 401 beim Sync – Token ungültig, Queue bleibt. */
  needsReauth: boolean;
}

/**
 * Typ/Interface `OfflineClockResult` für die Web-App.
 */
export type OfflineClockResult = ClockStatus & {
  /** true wenn lokal gequeued (noch nicht auf Server). */
  pendingSync?: boolean;
  queued?: boolean;
};

type Listener = (snap: OfflineQueueSnapshot) => void;

let dbPromise: Promise<IDBDatabase> | null = null;
let syncRunning = false;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;
let needsReauth = false;
const listeners = new Set<Listener>();

/**
 * API-/UI-Helfer `createClientEventId` (create Client Event Id).
 *
 * @returns string
 */
export function createClientEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB nicht verfügbar'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('byWorkerCreated', ['workerId', 'createdAt'], {
            unique: false,
          });
          store.createIndex('byCreated', 'createdAt', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });
}

async function putEntry(entry: OfflineClockEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  await idbReq(tx.objectStore(STORE).put(entry));
}

async function deleteEntry(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  await idbReq(tx.objectStore(STORE).delete(id));
}

async function getAllEntries(): Promise<OfflineClockEntry[]> {
  if (!isBrowser()) return [];
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const all = await idbReq(tx.objectStore(STORE).getAll());
    return (all as OfflineClockEntry[]).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  } catch {
    return [];
  }
}

async function getEntriesForWorker(
  workerId: string,
): Promise<OfflineClockEntry[]> {
  const all = await getAllEntries();
  return all.filter((e) => e.workerId === workerId);
}

function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (err instanceof ApiError) {
    return (
      err.statusCode === 0 ||
      err.statusCode === 408 ||
      err.statusCode === 502 ||
      err.statusCode === 503 ||
      err.statusCode === 504
    );
  }
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  return false;
}

async function clockFetchDirect<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const token = getWorkerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
  clearTimeout(timer);

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const payload = data as { message?: string | string[] } | null;
    const message = payload?.message
      ? Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message
      : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload as never);
  }
  return data as T;
}

function optimisticFromEntry(entry: OfflineClockEntry): OfflineClockResult {
  if (entry.type === 'CLOCK_IN') {
    const since = entry.occurredAtClient;
    const durationMinutes = Math.max(
      0,
      Math.round((Date.now() - new Date(since).getTime()) / 60000),
    );
    return {
      clockedIn: true,
      since,
      durationMinutes,
      project: entry.projectSnapshot ?? {
        id: entry.projectId,
        projectNumber: '',
        title: '',
      },
      timeEntryId: null,
      pendingSync: true,
      queued: true,
    };
  }
  return {
    clockedIn: false,
    since: null,
    durationMinutes: 0,
    project: null,
    timeEntryId: null,
    pendingSync: true,
    queued: true,
  };
}

/**
 * Optimistischen Stempel-Status aus Queue + optionalem Server-Status ableiten. FIFO-Replay der pending/syncing Einträge des Workers.
 *
 * @param workerId - Parameter `workerId` (string)
 * @param serverStatus - Parameter `serverStatus` (ClockStatus | null)
 * @returns OfflineClockResult
 */
export async function getOptimisticClockStatus(
  workerId: string,
  serverStatus?: ClockStatus | null,
): Promise<OfflineClockResult> {
  const entries = await getEntriesForWorker(workerId);
  let status: OfflineClockResult = serverStatus
    ? { ...serverStatus }
    : {
        clockedIn: false,
        since: null,
        durationMinutes: 0,
        project: null,
        timeEntryId: null,
      };

  for (const e of entries) {
    // Failed IN nicht als eingestempelt anzeigen; failed OUT belassen wir
    // als lokalen „aus“-Stand nur wenn wir ihn schon angewendet haben.
    if (e.status === 'failed' && e.type === 'CLOCK_IN') continue;
    if (e.type === 'CLOCK_IN') {
      status = optimisticFromEntry(e);
    } else {
      status = optimisticFromEntry(e);
    }
  }

  const pending = entries.some(
    (e) => e.status === 'pending' || e.status === 'syncing',
  );
  if (pending) {
    status = { ...status, pendingSync: true, queued: true };
  }
  return status;
}

/**
 * API-/UI-Helfer `getQueueSnapshot` (get Queue Snapshot).
 *
 * @param workerId - Parameter `workerId` (string)
 * @returns OfflineQueueSnapshot
 */
export async function getQueueSnapshot(
  workerId?: string,
): Promise<OfflineQueueSnapshot> {
  const all = await getAllEntries();
  const entries = workerId
    ? all.filter((e) => e.workerId === workerId)
    : all;
  const pendingCount = entries.filter(
    (e) => e.status === 'pending' || e.status === 'syncing',
  ).length;
  const failedCount = entries.filter((e) => e.status === 'failed').length;
  return {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    pendingCount,
    failedCount,
    entries,
    needsReauth,
  };
}

function notify(): void {
  void getQueueSnapshot().then((snap) => {
    for (const l of listeners) l(snap);
  });
}

/**
 * API-/UI-Helfer `subscribeOfflineQueue` (subscribe Offline Queue).
 *
 * @param listener - Parameter `listener` (Listener): ()
 */
export function subscribeOfflineQueue(listener: Listener): () => void {
  listeners.add(listener);
  void getQueueSnapshot().then(listener);
  ensureListeners();
  return () => {
    listeners.delete(listener);
  };
}

function ensureListeners(): void {
  if (!isBrowser() || listenersAttached) return;
  listenersAttached = true;
  window.addEventListener('online', () => {
    needsReauth = false;
    notify();
    void syncOfflineClockQueue();
  });
  window.addEventListener('offline', () => notify());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncOfflineClockQueue();
    }
  });
  window.addEventListener('focus', () => {
    void syncOfflineClockQueue();
  });
  if (!syncTimer) {
    syncTimer = setInterval(() => {
      void getAllEntries().then((all) => {
        if (all.some((e) => e.status === 'pending')) {
          void syncOfflineClockQueue();
        }
      });
    }, SYNC_INTERVAL_MS);
  }
}

async function enqueue(entry: OfflineClockEntry): Promise<void> {
  await putEntry(entry);
  ensureListeners();
  notify();
  void syncOfflineClockQueue();
}

/**
 * Typ/Interface `ClockInWithSnapshot` für die Web-App.
 */
export type ClockInWithSnapshot = ClockInBody & {
  clientEventId?: string;
  projectSnapshot?: ClockProject | null;
};

/**
 * Typ/Interface `ClockOutWithProject` für die Web-App.
 */
export type ClockOutWithProject = ClockOutBody & {
  clientEventId?: string;
  /** Lokal bekanntes Projekt (für Queue; API braucht es nicht). */
  projectId?: string;
};

/**
 * Clock-In mit Offline-Fallback. Generiert immer eine clientEventId. Bei Erfolg: Server-Status. Bei Netzfehler: Queue + optimistischer Status.
 *
 * @param body - Parameter `body` (ClockInWithSnapshot)
 * @returns OfflineClockResult
 */
export async function offlineAwareClockIn(
  body: ClockInWithSnapshot,
): Promise<OfflineClockResult> {
  ensureListeners();
  const clientEventId = body.clientEventId ?? createClientEventId();
  const occurredAtClient = body.occurredAtClient ?? new Date().toISOString();
  const { projectSnapshot, ...rest } = body;
  const payload = { ...rest, clientEventId, occurredAtClient };

  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new TypeError('Offline');
    }
    const status = await clockFetchDirect<ClockStatus>(
      '/time-entries/clock-in',
      payload,
    );
    return status;
  } catch (err) {
    if (!isNetworkFailure(err)) {
      throw err;
    }
    const entry: OfflineClockEntry = {
      id: clientEventId,
      type: 'CLOCK_IN',
      workerId: body.workerId,
      projectId: body.projectId,
      occurredAtClient,
      gps: {
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
      },
      sourceDevice: body.sourceDevice,
      comment: body.comment,
      activityTypeId: body.activityTypeId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      projectSnapshot: projectSnapshot ?? null,
    };
    await enqueue(entry);
    return optimisticFromEntry(entry);
  }
}

/**
 * Clock-Out mit Offline-Fallback.
 *
 * @param body - Parameter `body` (ClockOutWithProject)
 * @returns OfflineClockResult
 */
export async function offlineAwareClockOut(
  body: ClockOutWithProject,
): Promise<OfflineClockResult> {
  ensureListeners();
  const clientEventId = body.clientEventId ?? createClientEventId();
  const occurredAtClient = body.occurredAtClient ?? new Date().toISOString();
  const { projectId: bodyProjectId, ...rest } = body;
  const payload = { ...rest, clientEventId, occurredAtClient };
  const projectId =
    bodyProjectId ?? (await inferProjectIdForOut(body.workerId)) ?? '';

  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new TypeError('Offline');
    }
    const status = await clockFetchDirect<
      ClockStatus & { lastGrossMinutes?: number }
    >('/time-entries/clock-out', payload);
    return status;
  } catch (err) {
    if (!isNetworkFailure(err)) {
      throw err;
    }
    const entry: OfflineClockEntry = {
      id: clientEventId,
      type: 'CLOCK_OUT',
      workerId: body.workerId,
      projectId,
      occurredAtClient,
      gps: {
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
      },
      sourceDevice: body.sourceDevice,
      comment: body.comment,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    await enqueue(entry);
    return optimisticFromEntry(entry);
  }
}

async function inferProjectIdForOut(workerId: string): Promise<string | null> {
  const entries = await getEntriesForWorker(workerId);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === 'CLOCK_IN') return entries[i].projectId;
  }
  return null;
}

/**
 * FIFO-Sync: ein Request gleichzeitig. Erfolgreiche / idempotente Einträge werden entfernt; 4xx → failed; 401 → needsReauth (Queue bleibt).
 *
 * @returns void
 */
export async function syncOfflineClockQueue(): Promise<void> {
  if (!isBrowser() || syncRunning) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!getWorkerToken()) {
    const all = await getAllEntries();
    if (all.length > 0) {
      needsReauth = true;
      notify();
    }
    return;
  }

  syncRunning = true;
  try {
    const all = await getAllEntries();
    // Nur pending automatisch; failed nur nach manuellem Retry.
    const todo = all.filter((e) => e.status === 'pending');
    for (const entry of todo) {
      entry.status = 'syncing';
      await putEntry(entry);
      notify();

      try {
        const body = {
          workerId: entry.workerId,
          projectId: entry.projectId,
          occurredAtClient: entry.occurredAtClient,
          latitude: entry.gps?.latitude,
          longitude: entry.gps?.longitude,
          accuracy: entry.gps?.accuracy,
          sourceDevice: entry.sourceDevice,
          comment: entry.comment,
          clientEventId: entry.id,
          ...(entry.type === 'CLOCK_IN' && entry.activityTypeId
            ? { activityTypeId: entry.activityTypeId }
            : {}),
        };
        if (entry.type === 'CLOCK_IN') {
          await clockFetchDirect('/time-entries/clock-in', body);
        } else {
          const { projectId: _p, ...outBody } = body;
          await clockFetchDirect('/time-entries/clock-out', outBody);
        }
        await deleteEntry(entry.id);
        needsReauth = false;
        notify();
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 401) {
          needsReauth = true;
          entry.status = 'pending';
          entry.lastError =
            'Bitte erneut anmelden – Stempelungen warten';
          await putEntry(entry);
          notify();
          break;
        }
        if (isNetworkFailure(err)) {
          entry.status = 'pending';
          entry.lastError =
            err instanceof Error ? err.message : 'Netzwerkfehler';
          await putEntry(entry);
          notify();
          break;
        }
        entry.status = 'failed';
        entry.lastError =
          err instanceof Error ? err.message : 'Sync fehlgeschlagen';
        await putEntry(entry);
        notify();
        break;
      }
    }
  } finally {
    syncRunning = false;
    notify();
  }
}

/**
 * Markiert failed-Einträge wieder als pending und stößt Sync an.
 *
 * @param workerId - Parameter `workerId` (string)
 * @returns void
 */
export async function retryFailedClockEntries(
  workerId?: string,
): Promise<void> {
  const all = await getAllEntries();
  for (const e of all) {
    if (e.status !== 'failed') continue;
    if (workerId && e.workerId !== workerId) continue;
    e.status = 'pending';
    e.lastError = undefined;
    await putEntry(e);
  }
  notify();
  await syncOfflineClockQueue();
}

/**
 * Listener + periodischen Sync aktivieren (nach Login / Dashboard-Mount).
 */
export function startOfflineClockSync(): void {
  ensureListeners();
  void syncOfflineClockQueue();
}
