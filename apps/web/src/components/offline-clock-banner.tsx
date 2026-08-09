'use client';

/**
 * Banner für Offline-Status / wartende Stempelungen (Auftrag #13).
 * Wird auf Worker-Dashboard und Kiosk-Terminal eingeblendet.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getQueueSnapshot,
  retryFailedClockEntries,
  startOfflineClockSync,
  subscribeOfflineQueue,
  type OfflineQueueSnapshot,
} from '@/lib/offline-clock-queue';
import { texts } from '@/lib/texts';
import { cn } from '@/lib/utils';

interface OfflineClockBannerProps {
  workerId?: string;
  /** Dunkles Kiosk-Theme */
  variant?: 'light' | 'dark';
  className?: string;
  /** Nach erfolgreichem Sync (Queue leer) aufrufen – z. B. Status refreshen. */
  onSynced?: () => void;
}

export function OfflineClockBanner({
  workerId,
  variant = 'light',
  className,
  onSynced,
}: OfflineClockBannerProps): React.ReactNode {
  const t = texts.offlineClock;
  const [snap, setSnap] = useState<OfflineQueueSnapshot | null>(null);
  const [retrying, setRetrying] = useState(false);
  const hadPending = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const refreshSnap = useCallback(() => {
    void getQueueSnapshot(workerId).then((filtered) => {
      const pending =
        filtered.pendingCount > 0 || filtered.failedCount > 0;
      if (hadPending.current && !pending && filtered.online) {
        onSyncedRef.current?.();
      }
      hadPending.current = pending;
      setSnap(filtered);
    });
  }, [workerId]);

  useEffect(() => {
    startOfflineClockSync();
    refreshSnap();
    return subscribeOfflineQueue(() => refreshSnap());
  }, [refreshSnap]);

  if (!snap) return null;

  const showOffline = !snap.online;
  const showPending = snap.pendingCount > 0;
  const showFailed = snap.failedCount > 0;
  const showReauth = snap.needsReauth;

  if (!showOffline && !showPending && !showFailed && !showReauth) {
    return null;
  }

  const dark = variant === 'dark';

  const handleRetry = async (): Promise<void> => {
    setRetrying(true);
    try {
      await retryFailedClockEntries(workerId);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg px-3 py-2 text-sm',
        dark
          ? 'border border-amber-500/40 bg-amber-950/60 text-amber-100'
          : 'border border-amber-300 bg-amber-50 text-amber-950',
        className,
      )}
      role="status"
    >
      {showOffline && <p className="font-medium">{t.offline}</p>}
      {showPending && <p>{t.pending(snap.pendingCount)}</p>}
      {showReauth && <p>{t.needsReauth}</p>}
      {showFailed && (
        <div className="flex flex-wrap items-center gap-2">
          <p className={dark ? 'text-red-300' : 'text-red-700'}>
            {t.failed(
              snap.entries.find((e) => e.status === 'failed')?.lastError,
            )}
          </p>
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying || !snap.online}
            className={cn(
              'rounded px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50',
              dark ? 'text-amber-50' : 'text-amber-900',
            )}
          >
            {retrying ? t.retrying : t.retry}
          </button>
        </div>
      )}
    </div>
  );
}
