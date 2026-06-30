'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Plus, Search } from 'lucide-react';
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
import { WorkerAvatar } from '@/components/workers/worker-avatar';
import {
  AvailabilityBadge,
  WorkerTypeBadge,
} from '@/components/workers/worker-badges';
import {
  subcontractorsApi,
  teamsApi,
  workerFullName,
  workersApi,
  type SubcontractorListItem,
  type TeamListItem,
  type WorkerAvailability,
  type WorkerListItem,
  type WorkerListResponse,
  type WorkerType,
} from '@/lib/workers';
import { texts } from '@/lib/texts';

const LIMIT = 25;
const ALL = '__all__';
type SortField = 'name' | 'workerNumber' | 'hourlyRate';

const TYPES: WorkerType[] = ['EMPLOYED', 'SUBCONTRACTED'];
const AVAILABILITIES: WorkerAvailability[] = [
  'AVAILABLE',
  'ON_PROJECT',
  'SICK',
  'VACATION',
  'UNAVAILABLE',
];

const rate = (v: number | null): string =>
  v != null ? `${v.toLocaleString('de-DE')} €/h` : '–';

export default function WorkersPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.workers;

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [type, setType] = useState<string>(ALL);
  const [availability, setAvailability] = useState<string>(ALL);
  const [subcontractorId, setSubcontractorId] = useState<string>(ALL);
  const [teamId, setTeamId] = useState<string>(ALL);

  const [data, setData] = useState<WorkerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<SubcontractorListItem[]>([]);
  const [teams, setTeams] = useState<TeamListItem[]>([]);

  useEffect(() => {
    subcontractorsApi
      .list({ limit: 100 })
      .then((r) => setSubs(r.data))
      .catch(() => setSubs([]));
    teamsApi
      .list()
      .then(setTeams)
      .catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    const h = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    workersApi
      .list({
        page,
        limit: LIMIT,
        search: debounced,
        sortBy,
        sortDir,
        type: type === ALL ? undefined : type,
        availability: availability === ALL ? undefined : availability,
        subcontractorId: subcontractorId === ALL ? undefined : subcontractorId,
        teamId: teamId === ALL ? undefined : teamId,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, debounced, sortBy, sortDir, type, availability, subcontractorId, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  // Filteränderung → zurück auf Seite 1
  useEffect(() => {
    setPage(1);
  }, [type, availability, subcontractorId, teamId]);

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
  const noFilters =
    debounced.trim() === '' &&
    type === ALL &&
    availability === ALL &&
    subcontractorId === ALL &&
    teamId === ALL;

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button asChild className="min-h-[44px]">
          <Link href="/workers/new">
            <Plus className="h-4 w-4" />
            {t.newWorker}
          </Link>
        </Button>
      </PageHeader>

      {/* Suche + Filter */}
      <div className="mb-4 space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9 min-h-[44px]"
            aria-label={t.searchPlaceholder}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            value={type}
            onChange={setType}
            placeholder={t.filters.type}
            options={TYPES.map((v) => ({ value: v, label: t.type[v] }))}
          />
          <FilterSelect
            value={availability}
            onChange={setAvailability}
            placeholder={t.filters.availability}
            options={AVAILABILITIES.map((v) => ({
              value: v,
              label: t.availability[v],
            }))}
          />
          <FilterSelect
            value={subcontractorId}
            onChange={setSubcontractorId}
            placeholder={t.filters.subcontractor}
            options={subs.map((s) => ({ value: s.id, label: s.name }))}
          />
          <FilterSelect
            value={teamId}
            onChange={setTeamId}
            placeholder={t.filters.team}
            options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
          />
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {noFilters ? t.empty : t.noResults}
            </p>
            {noFilters && (
              <Button asChild variant="link" className="mt-2">
                <Link href="/workers/new">{t.emptyAction}</Link>
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
                  <TableHead className="w-px" />
                  <SortHead
                    label={t.columns.workerNumber}
                    active={sortBy === 'workerNumber'}
                    onClick={() => toggleSort('workerNumber')}
                  />
                  <SortHead
                    label={t.columns.name}
                    active={sortBy === 'name'}
                    onClick={() => toggleSort('name')}
                  />
                  <TableHead>{t.columns.type}</TableHead>
                  <TableHead>{t.columns.availability}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.subcontractor}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.project}
                  </TableHead>
                  <SortHead
                    label={t.columns.hourlyRate}
                    active={sortBy === 'hourlyRate'}
                    onClick={() => toggleSort('hourlyRate')}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((w) => (
                  <TableRow
                    key={w.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/workers/${w.id}`)}
                  >
                    <TableCell>
                      <WorkerAvatar
                        workerId={w.id}
                        hasPhoto={!!w.photoPath}
                        name={workerFullName(w)}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {w.workerNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {workerFullName(w)}
                    </TableCell>
                    <TableCell>
                      <WorkerTypeBadge type={w.workerType} />
                    </TableCell>
                    <TableCell>
                      <AvailabilityBadge availability={w.availability} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {w.subcontractor?.name ?? '–'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {w.assignments[0]?.project.title ?? '–'}
                    </TableCell>
                    <TableCell>{rate(w.hourlyRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Karten */}
          <div className="space-y-3 md:hidden">
            {items.map((w) => (
              <MobileCard key={w.id} worker={w} />
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            />
          )}
        </>
      )}
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
          {placeholder}: {texts.workers.filters.all}
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

function SortHead({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): React.ReactNode {
  return (
    <TableHead>
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

function MobileCard({ worker }: { worker: WorkerListItem }): React.ReactNode {
  const t = texts.workers;
  return (
    <Link href={`/workers/${worker.id}`} className="block">
      <Card className="active:bg-muted/50">
        <CardContent className="flex items-start gap-3 p-4">
          <WorkerAvatar
            workerId={worker.id}
            hasPhoto={!!worker.photoPath}
            name={workerFullName(worker)}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{workerFullName(worker)}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {worker.workerNumber}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <WorkerTypeBadge type={worker.workerType} />
              <AvailabilityBadge availability={worker.availability} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {worker.subcontractor?.name ?? t.type.EMPLOYED} · {rate(worker.hourlyRate)}
            </p>
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
  const p = texts.workers.pagination;
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
