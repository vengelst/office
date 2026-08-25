/**
 * Seite: Stempeluhr / Zeitraum (Office-Web).
 * Filter Tag/KW + Projekt/Monteur/Team; Overview-Tabelle; Timeline-Drawer.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PeriodTimelineDrawer } from '@/components/time-clock/period-timeline-drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  projectsApi,
  type ProjectListItem,
  type ProjectWorkerOption,
} from '@/lib/projects';
import {
  teamsApi,
  workerFullName,
  type TeamListItem,
} from '@/lib/workers';
import {
  formatMinutes,
  formatTime,
  isoWeekOf,
  timeEntriesApi,
  type OverviewRowStatus,
  type TimeOverviewRow,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';
import { cn } from '@/lib/utils';

const ALL = '__all__';

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO-Wochen-Tage (Mo–So) als YYYY-MM-DD. */
function datesInIsoWeek(weekYear: number, weekNumber: number): string[] {
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dow + 1 + (weekNumber - 1) * 7);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

function statusClass(status: OverviewRowStatus): string {
  switch (status) {
    case 'CLOCKED_IN':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'ON_BREAK':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'CLOCKED_OUT':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function warningLabel(code: string): string {
  const map = texts.timeClock.period.warnings as Record<string, string>;
  return map[code] ?? code;
}

export default function TimeClockPeriodPage(): React.ReactNode {
  const t = texts.timeClock;
  const p = t.period;
  const defaultWeek = isoWeekOf(new Date());

  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [weekYear, setWeekYear] = useState(defaultWeek.weekYear);
  const [weekNumber, setWeekNumber] = useState(defaultWeek.weekNumber);
  const [projectId, setProjectId] = useState(ALL);
  const [workerId, setWorkerId] = useState(ALL);
  const [teamId, setTeamId] = useState(ALL);

  const [rows, setRows] = useState<TimeOverviewRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [workers, setWorkers] = useState<ProjectWorkerOption[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [teams, setTeams] = useState<TeamListItem[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<TimeOverviewRow | null>(null);
  const [timelineDate, setTimelineDate] = useState(date);

  useEffect(() => {
    projectsApi
      .listWorkers()
      .then(setWorkers)
      .catch(() => setWorkers([]));
    projectsApi
      .list({ limit: 100 })
      .then((r) => setProjects(r.data))
      .catch(() => setProjects([]));
    teamsApi
      .list()
      .then(setTeams)
      .catch(() => setTeams([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params =
      mode === 'day'
        ? {
            date,
            projectId: projectId === ALL ? undefined : projectId,
            workerId: workerId === ALL ? undefined : workerId,
            teamId: teamId === ALL ? undefined : teamId,
          }
        : {
            weekYear: Number(weekYear),
            weekNumber: Number(weekNumber),
            projectId: projectId === ALL ? undefined : projectId,
            workerId: workerId === ALL ? undefined : workerId,
            teamId: teamId === ALL ? undefined : teamId,
          };
    timeEntriesApi
      .overview(params)
      .then((res) => setRows(res.rows))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [mode, date, weekYear, weekNumber, projectId, workerId, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const weekDays = useMemo(
    () => datesInIsoWeek(Number(weekYear), Number(weekNumber)),
    [weekYear, weekNumber],
  );

  const projectOptions = useMemo(
    () =>
      projects.map((proj) => ({
        id: proj.id,
        label: `${proj.projectNumber} · ${proj.title}`,
      })),
    [projects],
  );

  const openRow = (row: TimeOverviewRow): void => {
    setSelected(row);
    if (mode === 'day') {
      setTimelineDate(date);
    } else {
      const today = toDateInputValue(new Date());
      const fromEntry = row.firstClockInAt
        ? toDateInputValue(new Date(row.firstClockInAt))
        : null;
      const pick =
        weekDays.includes(today)
          ? today
          : fromEntry && weekDays.includes(fromEntry)
            ? fromEntry
            : weekDays[0] ?? date;
      setTimelineDate(pick);
    }
    setDrawerOpen(true);
  };

  return (
    <div>
      <PageHeader title={p.title} description={p.subtitle}>
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
          <Link href="/time-clock/period">{t.tabs.period}</Link>
        </Button>
        <Button asChild variant="ghost" className="min-h-[40px]">
          <Link href="/time-clock/gps">{t.tabs.gps}</Link>
        </Button>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">{p.breakFallbackHint}</p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{p.modeLabel}</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={mode === 'day' ? 'secondary' : 'ghost'}
              className="min-h-[44px]"
              onClick={() => setMode('day')}
            >
              {p.modeDay}
            </Button>
            <Button
              type="button"
              variant={mode === 'week' ? 'secondary' : 'ghost'}
              className="min-h-[44px]"
              onClick={() => setMode('week')}
            >
              {p.modeWeek}
            </Button>
          </div>
        </div>

        {mode === 'day' ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {p.filters.date}
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[44px] w-[11rem]"
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {p.filters.weekNumber}
              </Label>
              <Input
                type="number"
                min={1}
                max={53}
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className="min-h-[44px] w-[5rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {p.filters.weekYear}
              </Label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={weekYear}
                onChange={(e) => setWeekYear(Number(e.target.value))}
                className="min-h-[44px] w-[6rem]"
              />
            </div>
          </>
        )}

        <div className="w-full max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {p.filters.project}
          </Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{p.filters.allProjects}</SelectItem>
              {projects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.projectNumber} · {proj.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {p.filters.worker}
          </Label>
          <Select value={workerId} onValueChange={setWorkerId}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{p.filters.allWorkers}</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {workerFullName(w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {p.filters.team}
          </Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{p.filters.allTeams}</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading || rows === null ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {p.empty}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{p.columns.worker}</TableHead>
                  <TableHead>{p.columns.status}</TableHead>
                  <TableHead>{p.columns.firstIn}</TableHead>
                  <TableHead>{p.columns.lastOut}</TableHead>
                  <TableHead>{p.columns.gross}</TableHead>
                  <TableHead>{p.columns.breakBooked}</TableHead>
                  <TableHead>{p.columns.breakRule}</TableHead>
                  <TableHead>{p.columns.net}</TableHead>
                  <TableHead>{p.columns.warnings}</TableHead>
                  <TableHead>{p.columns.projects}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.worker.id}
                    className="cursor-pointer"
                    onClick={() => openRow(row)}
                  >
                    <TableCell className="font-medium">
                      {workerFullName(row.worker)}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {row.worker.workerNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(statusClass(row.status))}
                      >
                        {p.status[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatTime(row.firstClockInAt)}</TableCell>
                    <TableCell>{formatTime(row.lastClockOutAt)}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatMinutes(row.grossMinutes)}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatMinutes(row.breakBookedMinutes)}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatMinutes(row.breakRuleMinutes)}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatMinutes(row.netMinutes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.warnings.map((w) => (
                          <Badge
                            key={w}
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-900"
                          >
                            {warningLabel(w)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate text-sm text-muted-foreground">
                      {row.projects
                        .map((proj) => proj.projectNumber)
                        .join(', ') || '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <Card
                key={row.worker.id}
                className="cursor-pointer"
                onClick={() => openRow(row)}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {workerFullName(row.worker)}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.worker.workerNumber}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(statusClass(row.status))}
                    >
                      {p.status[row.status]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        {p.columns.firstIn}:{' '}
                      </span>
                      {formatTime(row.firstClockInAt)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {p.columns.lastOut}:{' '}
                      </span>
                      {formatTime(row.lastClockOutAt)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {p.columns.gross}:{' '}
                      </span>
                      <span className="font-mono">
                        {formatMinutes(row.grossMinutes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {p.columns.net}:{' '}
                      </span>
                      <span className="font-mono">
                        {formatMinutes(row.netMinutes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {p.columns.breakBooked}:{' '}
                      </span>
                      <span className="font-mono">
                        {formatMinutes(row.breakBookedMinutes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {p.columns.breakRule}:{' '}
                      </span>
                      <span className="font-mono">
                        {formatMinutes(row.breakRuleMinutes)}
                      </span>
                    </div>
                  </div>
                  {row.warnings.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {row.warnings.map((w) => (
                        <Badge
                          key={w}
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-amber-900"
                        >
                          {warningLabel(w)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {row.projects.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {row.projects
                        .map((proj) => `${proj.projectNumber} ${proj.title}`)
                        .join(' · ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <PeriodTimelineDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        workerId={selected?.worker.id ?? null}
        workerName={selected ? workerFullName(selected.worker) : ''}
        date={timelineDate}
        dayOptions={mode === 'week' ? weekDays : undefined}
        onDateChange={mode === 'week' ? setTimelineDate : undefined}
        projectOptions={
          selected && selected.projects.length > 0
            ? selected.projects.map((proj) => ({
                id: proj.id,
                label: `${proj.projectNumber} · ${proj.title}`,
              }))
            : projectOptions
        }
        onChanged={load}
      />
    </div>
  );
}
