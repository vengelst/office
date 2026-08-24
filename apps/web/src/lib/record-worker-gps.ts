/**
 * GPS erfassen und an die API senden (Login, Logout, Aktion, Intervall).
 * Scheitert still, wenn Ort oder Netz fehlen – Aktionen blockieren nicht.
 */

import { workerFetch } from '@/lib/timesheets';

export type WorkerGpsEventType =
  | 'MANUAL'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PHOTO'
  | 'ACTION';

export interface GpsCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Liest aktuelle Position (kurzer Timeout für Logout/Auto-Logout).
 */
export function readWorkerGps(timeoutMs = 8000): Promise<GpsCoords | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: Math.max(1000, timeoutMs - 500), maximumAge: 30_000 },
    );
  });
}

/**
 * GPS holen und als Ereignis speichern. Gibt die Koordinaten zurück (oder null).
 */
export async function recordWorkerGps(opts: {
  workerId: string;
  eventType: WorkerGpsEventType;
  projectId?: string | null;
  /** Bereits gelesene Koordinaten (z. B. vom Foto-Upload). */
  coords?: GpsCoords | null;
  timeoutMs?: number;
}): Promise<GpsCoords | null> {
  const coords =
    opts.coords !== undefined
      ? opts.coords
      : await readWorkerGps(opts.timeoutMs ?? 8000);
  if (!coords) return null;
  try {
    await workerFetch('/time-entries/gps-ping', {
      method: 'POST',
      body: {
        workerId: opts.workerId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        projectId: opts.projectId ?? undefined,
        eventType: opts.eventType,
      },
    });
  } catch {
    // Offline / API – Aktion trotzdem fortsetzen
  }
  return coords;
}

/** Hängt latitude/longitude/accuracy an FormData an, falls GPS verfügbar. */
export async function appendGpsToFormData(
  form: FormData,
  timeoutMs = 6000,
): Promise<GpsCoords | null> {
  const coords = await readWorkerGps(timeoutMs);
  if (!coords) return null;
  form.append('latitude', String(coords.latitude));
  form.append('longitude', String(coords.longitude));
  if (coords.accuracy != null) {
    form.append('accuracy', String(coords.accuracy));
  }
  return coords;
}
