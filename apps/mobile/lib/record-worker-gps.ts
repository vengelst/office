/**
 * GPS erfassen und an die API senden. Scheitert still bei fehlendem Ort/Netz.
 */

import { getCurrentPosition } from './location';
import { workerApi, type GeoPingBody } from './api';

export type WorkerGpsEventType = NonNullable<GeoPingBody['eventType']>;

/**
 * GPS holen und als Ereignis speichern. Gibt die Koordinaten zurück (oder null).
 */
export async function recordWorkerGps(opts: {
  workerId: string;
  eventType: WorkerGpsEventType;
  projectId?: string | null;
}): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> {
  const coords = await getCurrentPosition();
  if (!coords) return null;
  try {
    await workerApi.gpsPing({
      workerId: opts.workerId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      projectId: opts.projectId ?? undefined,
      eventType: opts.eventType,
    });
  } catch {
    // Offline / API – Aktion trotzdem fortsetzen
  }
  return coords;
}
