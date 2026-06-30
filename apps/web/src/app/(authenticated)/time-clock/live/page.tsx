'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WorkerAvatar } from '@/components/workers/worker-avatar';
import { workerFullName } from '@/lib/workers';
import {
  formatDuration,
  formatTime,
  timeEntriesApi,
  type LiveEntry,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

const REFRESH_MS = 30000;
const ALL = '__all__';

export default function TimeClockLivePage(): React.ReactNode {
  const t = texts.timeClock;
  const [entries, setEntries] = useState<LiveEntry[] | null>(null);
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    timeEntriesApi
      .live()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Sekunden-Timer für die Dauer-Anzeige.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries ?? []) {
      if (e.project) map.set(e.project.id, e.project.title);
    }
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    if (projectFilter === ALL) return entries;
    return entries.filter((e) => e.project?.id === projectFilter);
  }, [entries, projectFilter]);

  const elapsed = (since: string): number =>
    Math.floor((Date.now() - new Date(since).getTime()) / 1000);

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button variant="outline" className="min-h-[44px]" onClick={load}>
          <RefreshCw className="h-4 w-4" />
          {t.refresh}
        </Button>
        <Button asChild variant="outline" className="min-h-[44px]">
          <a href="/worker-app" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            {t.openWorkerApp}
          </a>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-emerald-600">
          {t.liveCount(filtered.length)}
        </p>
        <div className="w-full max-w-xs">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder={t.columns.project} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {t.columns.project}: {texts.workers.filters.all}
              </SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {entries === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop / Tablet */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-px" />
                  <TableHead>{t.columns.worker}</TableHead>
                  <TableHead>{t.columns.project}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.customer}
                  </TableHead>
                  <TableHead>{t.columns.since}</TableHead>
                  <TableHead>{t.columns.duration}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.worker.id}>
                    <TableCell>
                      <span className="inline-flex items-center">
                        <span className="mr-2 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <WorkerAvatar
                          workerId={e.worker.id}
                          hasPhoto={!!e.worker.photoPath}
                          name={workerFullName(e.worker)}
                          size="sm"
                        />
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {workerFullName(e.worker)}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {e.worker.workerNumber}
                      </span>
                    </TableCell>
                    <TableCell>{e.project?.title ?? '–'}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {e.project?.customer?.companyName ?? '–'}
                    </TableCell>
                    <TableCell>{formatTime(e.since)}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatDuration(elapsed(e.since))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((e) => (
              <Card key={e.worker.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <WorkerAvatar
                    workerId={e.worker.id}
                    hasPhoto={!!e.worker.photoPath}
                    name={workerFullName(e.worker)}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {workerFullName(e.worker)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {e.project?.title ?? '–'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.columns.since} {formatTime(e.since)}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-emerald-600">
                    {formatDuration(elapsed(e.since))}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
