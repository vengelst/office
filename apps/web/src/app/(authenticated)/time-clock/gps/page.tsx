/**
 * Seite: Stempeluhr / GPS-Daten (Office-Web).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { buildMapsUrl } from '@/lib/format';
import {
  timeEntriesApi,
  type GpsEventRow,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function TimeClockGpsPage(): React.ReactNode {
  const t = texts.timeClock;
  const [rows, setRows] = useState<GpsEventRow[] | null>(null);
  const [days, setDays] = useState(7);

  const load = useCallback(() => {
    timeEntriesApi
      .gpsEvents({ from: daysAgoIso(days), limit: 300 })
      .then(setRows)
      .catch(() => setRows([]));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const eventLabel = useMemo(
    () =>
      (type: GpsEventRow['eventType']): string =>
        t.gps.eventTypes[type] ?? type,
    [t.gps.eventTypes],
  );

  return (
    <div>
      <PageHeader title={t.gps.title} description={t.gps.subtitle}>
        <Button variant="outline" className="min-h-[44px]" onClick={load}>
          <RefreshCw className="h-4 w-4" />
          {t.refresh}
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant="ghost" className="min-h-[40px]">
          <Link href="/time-clock/live">{t.tabs.live}</Link>
        </Button>
        <Button asChild variant="secondary" className="min-h-[40px]">
          <Link href="/time-clock/gps">{t.tabs.gps}</Link>
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t.gps.daysBack}:</span>
          {[1, 7, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              className="min-h-[36px]"
              onClick={() => setDays(d)}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t.gps.empty}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.gps.columns.time}</TableHead>
                  <TableHead>{t.gps.columns.worker}</TableHead>
                  <TableHead>{t.gps.columns.project}</TableHead>
                  <TableHead>{t.gps.columns.event}</TableHead>
                  <TableHead>{t.gps.columns.location}</TableHead>
                  <TableHead>{t.gps.columns.accuracy}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const mapUrl = buildMapsUrl(r.latitude, r.longitude);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {new Date(r.recordedAt).toLocaleString('de-DE')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <WorkerAvatar
                            workerId={r.worker.id}
                            hasPhoto={!!r.worker.photoPath}
                            name={workerFullName(r.worker)}
                            size="sm"
                          />
                          <span>{workerFullName(r.worker)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.project
                          ? `${r.project.projectNumber} · ${r.project.title}`
                          : '—'}
                      </TableCell>
                      <TableCell>{eventLabel(r.eventType)}</TableCell>
                      <TableCell>
                        {mapUrl ? (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.accuracy != null
                          ? `±${Math.round(r.accuracy)} m`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
