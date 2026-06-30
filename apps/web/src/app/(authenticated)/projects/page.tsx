'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, CalendarRange, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ProjectStatusBadge } from '@/components/projects/status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import {
  projectsApi,
  type ProjectListItem,
  type ProjectListResponse,
  type ProjectStatus,
} from '@/lib/projects';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

const LIMIT = 25;
const ALL = '__all__';
const STATUSES: ProjectStatus[] = [
  'DRAFT',
  'PLANNED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELED',
];
type SortField = 'projectNumber' | 'title' | 'plannedStartDate' | 'priority';

export default function ProjectsPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.projects;
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('projectNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [data, setData] = useState<ProjectListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    projectsApi
      .list({
        page,
        limit: LIMIT,
        search: debounced,
        status: status === ALL ? undefined : status,
        sortBy,
        sortDir,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, debounced, status, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = (field: SortField): void => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const items = data?.data ?? [];
  const isEmpty = !loading && items.length === 0;
  const noFilter = debounced.trim() === '' && status === ALL;

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link href="/projects/calendar">
            <CalendarRange className="h-4 w-4" />
            {t.calendar.title}
          </Link>
        </Button>
        <Button asChild className="min-h-[44px]">
          <Link href="/projects/new">
            <Plus className="h-4 w-4" />
            {t.newProject}
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="min-h-[44px] pl-9"
            aria-label={t.searchPlaceholder}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="min-h-[44px] w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.fields.status}: Alle</SelectItem>
            {STATUSES.map((st) => (
              <SelectItem key={st} value={st}>
                {t.status[st]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {noFilter ? t.empty : t.noResults}
            </p>
            {noFilter && (
              <Button asChild variant="link" className="mt-2">
                <Link href="/projects/new">{t.emptyAction}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop / Tablet: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead
                    label={t.columns.projectNumber}
                    active={sortBy === 'projectNumber'}
                    onClick={() => toggleSort('projectNumber')}
                  />
                  <SortHead
                    label={t.columns.title}
                    active={sortBy === 'title'}
                    onClick={() => toggleSort('title')}
                  />
                  <TableHead>{t.columns.customer}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.serviceType}
                  </TableHead>
                  <SortHead
                    label={t.columns.priority}
                    active={sortBy === 'priority'}
                    onClick={() => toggleSort('priority')}
                  />
                  <TableHead>{t.columns.status}</TableHead>
                  <SortHead
                    label={t.columns.plannedStart}
                    active={sortBy === 'plannedStartDate'}
                    onClick={() => toggleSort('plannedStartDate')}
                    className="hidden lg:table-cell"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {p.projectNumber}
                    </TableCell>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{p.customer.companyName}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {t.serviceType[p.serviceType]}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={p.priority} />
                    </TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatDate(p.plannedStartDate) || '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Cards */}
          <div className="space-y-3 md:hidden">
            {items.map((p) => (
              <MobileCard key={p.id} project={p} />
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onPrev={() => setPage((x) => Math.max(1, x - 1))}
              onNext={() => setPage((x) => Math.min(data.totalPages, x + 1))}
            />
          )}
        </>
      )}
    </div>
  );
}

function SortHead({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}): React.ReactNode {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${active ? 'text-foreground' : 'text-muted-foreground/50'}`}
        />
      </button>
    </TableHead>
  );
}

function MobileCard({ project }: { project: ProjectListItem }): React.ReactNode {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="active:bg-muted/50">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{project.title}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {project.projectNumber} · {project.customer.companyName}
              </p>
            </div>
            <ProjectStatusBadge status={project.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <PriorityBadge priority={project.priority} />
            <span>{texts.projects.serviceType[project.serviceType]}</span>
            {project.plannedStartDate && (
              <span>· {formatDate(project.plannedStartDate)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}): React.ReactNode {
  const p = texts.projects.pagination;
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {total} {p.showing} · {p.page} {page} {p.of} {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          disabled={page <= 1}
          onClick={onPrev}
        >
          {p.prev}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          {p.next}
        </Button>
      </div>
    </div>
  );
}

function ListSkeleton(): React.ReactNode {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
