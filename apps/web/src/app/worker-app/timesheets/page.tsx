'use client';

/**
 * Stundenzettel-Liste in der Monteur-App (`/worker-app/timesheets`).
 * Zeigt nur eigene Wochenzettel; CTA zum Unterschreiben bei DRAFT/REJECTED.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, PenLine, RotateCw } from 'lucide-react';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';
import {
  formatHours,
  workerApi,
  type TimesheetListItem,
  type TimesheetListResponse,
} from '@/lib/timesheets';
import { useWorkerSessionGuard } from '../use-worker-session-guard';

function canSignSheet(sheet: TimesheetListItem): boolean {
  return sheet.status === 'DRAFT' || sheet.status === 'REJECTED';
}

export default function WorkerTimesheetsPage(): ReactNode {
  const router = useRouter();
  const worker = useWorkerSessionGuard();
  const t = texts.workerApp.timesheets;

  const [data, setData] = useState<TimesheetListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setError('');
    setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    try {
      const res = await workerApi.listTimesheets({
        page: 1,
        limit: 50,
        sortBy: 'weekYear',
        sortDir: 'desc',
      });
      setData(res);
    } catch (err) {
      setData(null);
      setError(
        err instanceof ApiError ? err.message : t.loadError,
      );
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    if (!worker) return;
    void load();
  }, [worker, load]);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!worker) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        {texts.common.loading}
      </p>
    );
  }

  const items = data?.data ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.push('/worker-app/dashboard')}
          className="inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.back}
        </button>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border px-3 text-sm"
          disabled={loading}
        >
          <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t.reload}
        </button>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {offline && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {t.offlineHint}
        </p>
      )}

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">
          {texts.common.loading}
        </p>
      ) : error ? (
        <p className="text-center text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((sheet) => (
            <li key={sheet.id}>
              <button
                type="button"
                onClick={() =>
                  router.push(`/worker-app/timesheets/${sheet.id}`)
                }
                className="flex w-full min-h-[72px] items-center gap-3 rounded-xl border bg-card p-4 text-left transition active:scale-[0.99]"
              >
                <span className="flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {t.week} {sheet.weekNumber}/{sheet.weekYear}
                    </span>
                    <TimesheetStatusBadge status={sheet.status} />
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {sheet.project.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t.net}: {formatHours(sheet.totalMinutesNet)}
                  </span>
                </span>
                {canSignSheet(sheet) ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    <PenLine className="h-3.5 w-3.5" />
                    {t.signCta}
                  </span>
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
