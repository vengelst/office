'use client';

/**
 * Sichtbares Debug-Log im Kiosk (Flicker-/Redirect-Diagnose).
 * Button unten rechts; mit ?debug=1 oder nach Tippen dauerhaft offen.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  clearKioskDebug,
  getKioskDebugEntries,
  installKioskFetchLogger,
  isKioskDebugOpen,
  kioskDebugLog,
  setKioskDebugOpen,
  subscribeKioskDebug,
  type KioskDebugEntry,
} from '@/lib/kiosk-debug';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function levelClass(level: KioskDebugEntry['level']): string {
  switch (level) {
    case 'error':
      return 'text-red-400';
    case 'warn':
      return 'text-amber-400';
    case 'nav':
      return 'text-cyan-400';
    case 'api':
      return 'text-emerald-400';
    case 'mount':
      return 'text-violet-400';
    default:
      return 'text-gray-300';
  }
}

export function KioskDebugPanel(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<readonly KioskDebugEntry[]>([]);

  useEffect(() => {
    installKioskFetchLogger();
    kioskDebugLog('info', 'Debug-Panel mount', window.location.href);
    setOpen(isKioskDebugOpen());
    setEntries([...getKioskDebugEntries()]);
    return subscribeKioskDebug(() => {
      setEntries([...getKioskDebugEntries()]);
      setOpen(isKioskDebugOpen());
    });
  }, []);

  useEffect(() => {
    const onVis = () => {
      kioskDebugLog(
        'info',
        `visibility=${document.visibilityState}`,
        window.location.pathname,
      );
    };
    const onPageShow = (e: PageTransitionEvent) => {
      kioskDebugLog('nav', 'pageshow', `persisted=${e.persisted}`);
    };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !open;
    setKioskDebugOpen(next);
    setOpen(next);
  }, [open]);

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[100] flex flex-col items-end gap-2">
      {open && (
        <div
          className="pointer-events-auto flex max-h-[45vh] w-[min(100vw-1.5rem,28rem)] flex-col overflow-hidden rounded-xl border border-amber-500/50 bg-black/95 shadow-2xl"
          role="log"
          aria-label="Kiosk Debug-Log"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">
              Kiosk-Log ({entries.length})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => clearKioskDebug()}
                className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300"
              >
                Leeren
              </button>
              <button
                type="button"
                onClick={toggle}
                className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300"
              >
                Zu
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2 font-mono text-[10px] leading-snug">
            {[...entries].reverse().map((e) => (
              <div key={e.id} className={levelClass(e.level)}>
                <span className="text-gray-500">{formatTime(e.ts)}</span>{' '}
                <span className="uppercase opacity-70">[{e.level}]</span>{' '}
                {e.message}
                {e.detail ? (
                  <span className="block truncate text-gray-500">{e.detail}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        className="pointer-events-auto rounded-full border border-amber-500/60 bg-amber-950/90 px-3 py-2 text-xs font-semibold text-amber-200 shadow-lg"
        style={{ minHeight: '40px' }}
      >
        {open ? 'Log zu' : 'Log'}
      </button>
    </div>
  );
}
