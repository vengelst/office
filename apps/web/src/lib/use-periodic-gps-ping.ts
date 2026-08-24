/**
 * Periodischer GPS-Ping während einer aktiven Schicht (Intervall aus Settings).
 */

'use client';

import { useEffect, useRef } from 'react';
import { workerFetch } from '@/lib/timesheets';
import { kioskSettingsApi } from '@/lib/kiosk-settings';

const DEFAULT_INTERVAL_MIN = 20;

async function readPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy?: number;
} | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 12000);
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  });
}

/**
 * Sendet in regelmäßigen Abständen GPS an die API, solange `active` true ist.
 */
export function usePeriodicGpsPing(opts: {
  active: boolean;
  workerId: string | null | undefined;
  projectId?: string | null;
}): void {
  const { active, workerId, projectId } = opts;
  const projectRef = useRef(projectId);
  projectRef.current = projectId;

  useEffect(() => {
    if (!active || !workerId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const ping = async (): Promise<void> => {
      const geo = await readPosition();
      if (cancelled || !geo) return;
      try {
        await workerFetch('/time-entries/gps-ping', {
          method: 'POST',
          body: {
            workerId,
            latitude: geo.latitude,
            longitude: geo.longitude,
            accuracy: geo.accuracy,
            projectId: projectRef.current ?? undefined,
          },
        });
      } catch {
        // Offline / nicht eingestempelt – still ignorieren
      }
    };

    void (async () => {
      let minutes = DEFAULT_INTERVAL_MIN;
      try {
        const cfg = await kioskSettingsApi.getPublic();
        if (
          typeof cfg.gpsIntervalMinutes === 'number' &&
          cfg.gpsIntervalMinutes >= 1
        ) {
          minutes = cfg.gpsIntervalMinutes;
        }
      } catch {
        // default
      }
      if (cancelled) return;
      void ping();
      timer = setInterval(() => void ping(), minutes * 60_000);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [active, workerId]);
}
