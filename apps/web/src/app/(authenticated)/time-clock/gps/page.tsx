/**
 * Seite: Stempeluhr / GPS-Daten (Office-Web).
 * Filter: Monteur, Projekt, Datumsbereich von–bis; Karten-Spur.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { GpsTrackMap } from '@/components/time-clock/gps-track-map';
import { WorkerAvatar } from '@/components/workers/worker-avatar';
import { workerFullName } from '@/lib/workers';
import { buildMapsUrl } from '@/lib/format';
import {
  timeEntriesApi,
  type GpsEventRow,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

const ALL = '__all__';

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toISOString();
}

function endOfDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d.toISOString();
}

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export default function TimeClockGpsPage(): React.ReactNode {
  const t = texts.timeClock;
  const [rows, setRows] = useState<GpsEventRow[] | null>(null);
  const [workerFilter, setWorkerFilter] = useState(ALL);
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState(() =>
    toDateInputValue(daysAgoDate(7)),
  );
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));

  const load = useCallback(() => {
    timeEntriesApi
      .gpsEvents({
        from: startOfDayIso(dateFrom),
        to: endOfDayIso(dateTo),
        limit: 500,
        workerId: workerFilter === ALL ? undefined : workerFilter,
        projectId: projectFilter === ALL ? undefined : projectFilter,
      })
      .then(setRows)
      .catch(() => setRows([]));
  }, [dateFrom, dateTo, workerFilter, projectFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const [workerOptions, setWorkerOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [projectOptions, setProjectOptions] = useState<
    { id: string; label: string }[]
  >([]);

  useEffect(() => {
    timeEntriesApi
      .gpsEvents({
        from: startOfDayIso(dateFrom),
        to: endOfDayIso(dateTo),
        limit: 500,
      })
      .then((all) => {
        const workers = new Map<string, string>();
        const projects = new Map<string, string>();
        for (const r of all) {
          workers.set(r.worker.id, workerFullName(r.worker));
          if (r.project) {
            projects.set(
              r.project.id,
              `${r.project.projectNumber} · ${r.project.title}`,
            );
          }
        }
        setWorkerOptions(
          [...workers.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de')),
        );
        setProjectOptions(
          [...projects.entries()]
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'de')),
        );
      })
      .catch(() => {
        setWorkerOptions([]);
        setProjectOptions([]);
      });
  }, [dateFrom, dateTo]);

  const eventLabel = useMemo(
    () =>
      (type: GpsEventRow['eventType']): string =>
        t.gps.eventTypes[type] ?? type,
    [t.gps.eventTypes],
  );

  const mapPoints = useMemo(() => {
    if (!rows || workerFilter === ALL) return [];
    return [...rows]
      .sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      )
      .map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        recordedAt: r.recordedAt,
        label: eventLabel(r.eventType),
      }));
  }, [rows, workerFilter, eventLabel]);

  const applyPresetDays = (days: number) => {
    setDateFrom(toDateInputValue(daysAgoDate(days)));
    setDateTo(toDateInputValue(new Date()));
  };

  return (
    <div>
      <PageHeader title={t.gps.title} description={t.gps.subtitle}>
        <Button variant="outline" className="min-h-[44px]" onClick={load}>
          <RefreshCw className="h-4 w-4" />
          {t.refresh}
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" className="min-h-[40px]">
          <Link href="/time-clock/live">{t.tabs.live}</Link>
        </Button>
        <Button asChild variant="secondary" className="min-h-[40px]">
          <Link href="/time-clock/gps">{t.tabs.gps}</Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs space-y-1">
          <label className="text-xs text-muted-foreground">
            {t.gps.selectWorker}
          </label>
          <Select value={workerFilter} onValueChange={setWorkerFilter}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder={t.gps.selectWorker} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.gps.allWorkers}</SelectItem>
              {workerOptions.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full max-w-xs space-y-1">
          <label className="text-xs text-muted-foreground">
            {t.gps.selectProject}
          </label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder={t.gps.selectProject} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.gps.allProjects}</SelectItem>
              {projectOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t.gps.dateFrom}</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="min-h-[44px] w-[11rem]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t.gps.dateTo}</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="min-h-[44px] w-[11rem]"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t.gps.daysBack}:</span>
          {[1, 7, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant="outline"
              className="min-h-[36px]"
              onClick={() => applyPresetDays(d)}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      {workerFilter === ALL ? (
        <p className="mb-4 text-sm text-muted-foreground">{t.gps.mapNeedWorker}</p>
      ) : mapPoints.length > 0 ? (
        <Card className="mb-6">
          <CardContent className="space-y-2 p-4">
            <div>
              <p className="text-sm font-medium">{t.gps.mapTitle}</p>
              <p className="text-xs text-muted-foreground">{t.gps.mapHint}</p>
            </div>
            <GpsTrackMap points={mapPoints} />
          </CardContent>
        </Card>
      ) : null}

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
