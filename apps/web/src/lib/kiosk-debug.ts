/**
 * Ringpuffer-Log für den Kiosk (Navigation, Mounts, Fetch).
 * Sichtbar über KioskDebugPanel; immer befüllt (auch bei geschlossenem Panel).
 */

export type KioskDebugLevel = 'info' | 'warn' | 'error' | 'nav' | 'api' | 'mount';

export interface KioskDebugEntry {
  id: number;
  ts: number;
  level: KioskDebugLevel;
  message: string;
  detail?: string;
}

const MAX = 200;
const STORAGE_KEY = 'office_kiosk_debug_open';

let seq = 0;
const entries: KioskDebugEntry[] = [];
const listeners = new Set<() => void>();
let fetchPatched = false;

function notify(): void {
  listeners.forEach((l) => l());
}

export function kioskDebugLog(
  level: KioskDebugLevel,
  message: string,
  detail?: unknown,
): void {
  let detailStr: string | undefined;
  if (detail !== undefined) {
    try {
      detailStr =
        typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400);
    } catch {
      detailStr = String(detail);
    }
  }
  entries.push({
    id: ++seq,
    ts: Date.now(),
    level,
    message,
    detail: detailStr,
  });
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  if (typeof console !== 'undefined') {
    const line = `[kiosk ${level}] ${message}${detailStr ? ` ${detailStr}` : ''}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
  notify();
}

export function getKioskDebugEntries(): readonly KioskDebugEntry[] {
  return entries;
}

export function clearKioskDebug(): void {
  entries.length = 0;
  notify();
}

export function subscribeKioskDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isKioskDebugOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      return true;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    // Default: offen, bis der Nutzer schließt (Diagnose Flicker-Loop)
    if (stored === null) return true;
    return stored === '1';
  } catch {
    return true;
  }
}

export function setKioskDebugOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  } catch {
    // ignore
  }
  notify();
}

/** Einmalig window.fetch wrappen – loggt API-Aufrufe unter /api. */
export function installKioskFetchLogger(): void {
  if (typeof window === 'undefined' || fetchPatched) return;
  fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const isApi = url.includes('/api/') || url.includes('/time-entries/');
    const started = Date.now();
    if (isApi) {
      kioskDebugLog('api', `${method} →`, url.replace(/^https?:\/\/[^/]+/, ''));
    }
    try {
      const res = await orig(input, init);
      if (isApi) {
        kioskDebugLog(
          res.ok ? 'api' : 'error',
          `${method} ${res.status} (${Date.now() - started}ms)`,
          url.replace(/^https?:\/\/[^/]+/, ''),
        );
      }
      return res;
    } catch (err) {
      if (isApi) {
        kioskDebugLog('error', `${method} FAIL`, String(err));
      }
      throw err;
    }
  };
  kioskDebugLog('info', 'Fetch-Logger aktiv');
}

export function isKioskPath(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.startsWith('/kiosk') ||
    window.location.hostname.startsWith('work.')
  );
}
