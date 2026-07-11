'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  equipmentApi,
  EQUIPMENT_STATUSES,
  type EquipmentListItem,
  type EquipmentListResponse,
} from '@/lib/equipment';
import { texts } from '@/lib/texts';

const LIMIT = 25;
const ALL = '__all__';

const statusColor: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  IN_REPAIR: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  RETIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

function StatusBadge({ status }: { status: string }): React.ReactNode {
  const t = texts.equipment;
  return (
    <Badge variant="secondary" className={statusColor[status] ?? ''}>
      {t.status[status] ?? status}
    </Badge>
  );
}

function ConditionBadge({ condition }: { condition: string }): React.ReactNode {
  const t = texts.equipment;
  return (
    <span className="text-sm text-muted-foreground">
      {t.condition[condition] ?? condition}
    </span>
  );
}

function assignedWorkerName(item: EquipmentListItem): string | null {
  if (!item.currentAssignment) return null;
  const w = item.currentAssignment.worker;
  return `${w.firstName} ${w.lastName}`;
}

export default function EquipmentPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.equipment;

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [categories, setCategories] = useState<string[]>([]);

  const [data, setData] = useState<EquipmentListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    equipmentApi.listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    equipmentApi
      .list({
        page,
        limit: LIMIT,
        search: debounced,
        status: statusFilter === ALL ? undefined : statusFilter,
        category: categoryFilter === ALL ? undefined : categoryFilter,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, debounced, statusFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [statusFilter, categoryFilter]);

  const items = data?.data ?? [];
  const isEmpty = !loading && items.length === 0;
  const noFilters =
    debounced.trim() === '' && statusFilter === ALL && categoryFilter === ALL;

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button asChild className="min-h-[44px]">
          <Link href="/equipment/new">
            <Plus className="h-4 w-4" />
            {t.new}
          </Link>
        </Button>
      </PageHeader>

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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder={t.filters.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {t.filters.status}: {t.filters.all}
              </SelectItem>
              {EQUIPMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t.status[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder={t.filters.category} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {t.filters.category}: {t.filters.all}
              </SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {noFilters ? t.empty : t.noResults}
            </p>
            {noFilters && (
              <Button asChild variant="link" className="mt-2">
                <Link href="/equipment/new">{t.emptyAction}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.name}</TableHead>
                  <TableHead>{t.columns.category}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead>{t.columns.condition}</TableHead>
                  <TableHead>{t.columns.assignedTo}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/equipment/${item.id}`)}
                  >
                    <TableCell className="font-medium">
                      {item.name}
                      {item.inventoryNumber && (
                        <span className="block text-xs font-mono text-muted-foreground">
                          {item.inventoryNumber}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.category && (
                        <Badge variant="outline">{item.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      <ConditionBadge condition={item.condition} />
                    </TableCell>
                    <TableCell>
                      {assignedWorkerName(item) ?? (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <Link key={item.id} href={`/equipment/${item.id}`} className="block">
                <Card className="active:bg-muted/50">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        {item.inventoryNumber && (
                          <p className="text-xs font-mono text-muted-foreground">
                            {item.inventoryNumber}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {item.category && <Badge variant="outline">{item.category}</Badge>}
                      <ConditionBadge condition={item.condition} />
                    </div>
                    {assignedWorkerName(item) && (
                      <p className="text-sm">→ {assignedWorkerName(item)}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

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
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t.pagination.prev}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                >
                  {t.pagination.next}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
