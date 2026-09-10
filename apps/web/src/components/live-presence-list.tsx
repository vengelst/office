'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration, type ScopedLiveEntry } from '@/lib/timesheets';

export interface LivePresenceLabels {
  title: string;
  empty: string;
  error: string;
  reload: string;
  since: string;
  activity: string;
  project: string;
}

interface LivePresenceListProps {
  /** Lädt die scoped Live-Liste (Worker- oder Office-Token). */
  load: () => Promise<ScopedLiveEntry[]>;
  /** Optionaler Projektfilter – bei Änderung neu laden. */
  projectId?: string | null;
  labels: LivePresenceLabels;
  /** Polling-Intervall in ms (Default 30s). */
  refreshMs?: number;
  className?: string;
}

/**
 * Touch-taugliche Live-Anwesenheitsliste für Personal-App und Kunden-PL.
 * Zeigt Name, Projekt, Dauer und optionale Tätigkeit – ohne Büro-Aktionen.
 */
export function LivePresenceList({
  load,
  projectId,
  labels,
  refreshMs = 30000,
  className,
}: LivePresenceListProps): React.ReactNode {
  const [rows, setRows] = useState<ScopedLiveEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    load()
      .then((data) => {
        setRows(data);
        setError(false);
      })
      .catch(() => {
        setRows(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, refreshMs);
    return () => clearInterval(id);
  }, [refresh, refreshMs, projectId]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = (since: string): number =>
    Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));

  return (
    <section
      className={
        className ??
        'rounded-2xl border border-border bg-card p-4 shadow-sm'
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold">{labels.title}</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] min-w-[44px]"
          onClick={refresh}
          disabled={loading}
          aria-label={labels.reload}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{labels.error}</p>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">{labels.reload}…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const name = `${row.worker.firstName} ${row.worker.lastName}`.trim();
            return (
              <li
                key={row.timeEntryId}
                className="flex min-h-[56px] flex-col gap-0.5 rounded-xl bg-muted/50 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-tight">{name}</span>
                  <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                    {labels.since} {formatDuration(elapsed(row.since))}
                  </span>
                </div>
                {row.project && (
                  <p className="text-sm text-muted-foreground">
                    <span className="sr-only">{labels.project}: </span>
                    {row.project.projectNumber} · {row.project.title}
                  </p>
                )}
                {row.activity?.name && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      {labels.activity}:{' '}
                    </span>
                    {row.activity.name}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
