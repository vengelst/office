'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/components/ui/use-toast';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { ApiError } from '@/lib/api-client';
import {
  projectsApi,
  type ProjectListItem,
  type ProjectWorkerOption,
} from '@/lib/projects';
import { workerFullName } from '@/lib/workers';
import {
  formatHours,
  isoWeekOf,
  timesheetsApi,
  type TimesheetListResponse,
  type WeeklyTimesheetStatus,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

const LIMIT = 25;
const ALL = '__all__';
const STATUSES: WeeklyTimesheetStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
];

export default function TimesheetsPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.timesheets;

  const [data, setData] = useState<TimesheetListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [workerId, setWorkerId] = useState(ALL);
  const [projectId, setProjectId] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const [workers, setWorkers] = useState<ProjectWorkerOption[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    projectsApi
      .listWorkers()
      .then(setWorkers)
      .catch(() => setWorkers([]));
    projectsApi
      .list({ limit: 100 })
      .then((r) => setProjects(r.data))
      .catch(() => setProjects([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    timesheetsApi
      .list({
        page,
        limit: LIMIT,
        workerId: workerId === ALL ? undefined : workerId,
        projectId: projectId === ALL ? undefined : projectId,
        status: status === ALL ? undefined : status,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, workerId, projectId, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [workerId, projectId, status]);

  const items = data?.data ?? [];
  const isEmpty = !loading && items.length === 0;
  const noFilters = workerId === ALL && projectId === ALL && status === ALL;

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button className="min-h-[44px]" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t.generate}
        </Button>
      </PageHeader>

      {/* Filter */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FilterSelect
          value={workerId}
          onChange={setWorkerId}
          placeholder={t.filters.worker}
          options={workers.map((w) => ({
            value: w.id,
            label: workerFullName(w),
          }))}
        />
        <FilterSelect
          value={projectId}
          onChange={setProjectId}
          placeholder={t.filters.project}
          options={projects.map((p) => ({ value: p.id, label: p.title }))}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder={t.filters.status}
          options={STATUSES.map((s) => ({ value: s, label: t.status[s] }))}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {noFilters ? t.empty : t.noResults}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.columns.week}</TableHead>
                <TableHead>{t.columns.worker}</TableHead>
                <TableHead>{t.columns.project}</TableHead>
                <TableHead className="text-right">{t.columns.net}</TableHead>
                <TableHead>{t.columns.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((ts) => (
                <TableRow
                  key={ts.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/timesheets/${ts.id}`)}
                >
                  <TableCell className="font-medium">
                    KW {ts.weekNumber}/{ts.weekYear}
                  </TableCell>
                  <TableCell>{workerFullName(ts.worker)}</TableCell>
                  <TableCell>{ts.project.title}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatHours(ts.totalMinutesNet)}
                  </TableCell>
                  <TableCell>
                    <TimesheetStatusBadge status={ts.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {data.total} {t.pagination.showing} · {t.pagination.page}{' '}
            {data.page} {t.pagination.of} {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t.pagination.prev}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              {t.pagination.next}
            </Button>
          </div>
        </div>
      )}

      <GenerateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workers={workers}
        projects={projects}
        onGenerated={(id) => router.push(`/timesheets/${id}`)}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}): React.ReactNode {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="min-h-[44px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>
          {placeholder}: {texts.timesheets.filters.all}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GenerateDialog({
  open,
  onOpenChange,
  workers,
  projects,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workers: ProjectWorkerOption[];
  projects: ProjectListItem[];
  onGenerated: (id: string) => void;
}): React.ReactNode {
  const t = texts.timesheets.generateDialog;
  const { toast } = useToast();
  const defaultWeek = isoWeekOf(new Date());

  const [workerId, setWorkerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [weekYear, setWeekYear] = useState(defaultWeek.weekYear);
  const [weekNumber, setWeekNumber] = useState(defaultWeek.weekNumber);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (!workerId || !projectId) return;
    setBusy(true);
    try {
      const sheet = await timesheetsApi.generate({
        workerId,
        projectId,
        weekYear: Number(weekYear),
        weekNumber: Number(weekNumber),
      });
      toast({ description: texts.timesheets.toast.generated });
      onOpenChange(false);
      onGenerated(sheet.id);
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.timesheets.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.worker}</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder={t.selectWorker} />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {workerFullName(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.project}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder={t.selectProject} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.year}</Label>
              <Input
                type="number"
                value={weekYear}
                onChange={(e) => setWeekYear(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.week}</Label>
              <Input
                type="number"
                min={1}
                max={53}
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="min-h-[44px]"
            disabled={!workerId || !projectId || busy}
            onClick={submit}
          >
            {busy ? t.generating : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
