/**
 * Periodischer GPS-Ping während einer aktiven Schicht (Intervall aus Settings).
 */

'use client';

import { useEffect, useRef } from 'react';
import { kioskSettingsApi } from '@/lib/kiosk-settings';
import { recordWorkerGps } from '@/lib/record-worker-gps';

const DEFAULT_INTERVAL_MIN = 20;

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
      if (cancelled) return;
      await recordWorkerGps({
        workerId,
        eventType: 'MANUAL',
        projectId: projectRef.current,
        timeoutMs: 12000,
      });
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
