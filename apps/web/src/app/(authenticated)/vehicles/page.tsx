'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
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
import {
  CategoryBadge,
  VehicleExpiryDate,
  VehicleStatusBadge,
} from '@/components/vehicles/vehicle-badges';
import {
  vehiclesApi,
  vehicleTitle,
  VEHICLE_CATEGORIES,
  VEHICLE_OWNER_TYPES,
  type VehicleListItem,
  type VehicleListResponse,
} from '@/lib/vehicles';
import { workerFullName } from '@/lib/workers';
import { texts } from '@/lib/texts';

const LIMIT = 25;
const ALL = '__all__';

const STATUSES = ['available', 'assigned'] as const;

const ownerLabel = (v: VehicleListItem): string => {
  const t = texts.vehicles;
  if (v.ownerType === 'SUBCONTRACTOR') {
    return v.subcontractor?.name ?? t.ownerType.SUBCONTRACTOR;
  }
  return t.ownerType.OWN;
};

const assignedName = (v: VehicleListItem): string | null =>
  v.currentAssignment ? workerFullName(v.currentAssignment.worker) : null;

export default function VehiclesPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.vehicles;

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [ownerType, setOwnerType] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  const [data, setData] = useState<VehicleListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    vehiclesApi
      .list({
        page,
        limit: LIMIT,
        search: debounced,
        ownerType: ownerType === ALL ? undefined : ownerType,
        category: category === ALL ? undefined : category,
        status: status === ALL ? undefined : status,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, debounced, ownerType, category, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [ownerType, category, status]);

  const items = data?.data ?? [];
  const isEmpty = !loading && items.length === 0;
  const noFilters =
    debounced.trim() === '' &&
    ownerType === ALL &&
    category === ALL &&
    status === ALL;

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button asChild className="min-h-[44px]">
          <Link href="/vehicles/new">
            <Plus className="h-4 w-4" />
            {t.newVehicle}
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <FilterSelect
            value={ownerType}
            onChange={setOwnerType}
            placeholder={t.filters.ownerType}
            options={VEHICLE_OWNER_TYPES.map((v) => ({
              value: v,
              label: t.ownerType[v],
            }))}
          />
          <FilterSelect
            value={category}
            onChange={setCategory}
            placeholder={t.filters.category}
            options={VEHICLE_CATEGORIES.map((v) => ({
              value: v,
              label: t.category[v],
            }))}
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            placeholder={t.filters.status}
            options={STATUSES.map((v) => ({ value: v, label: t.status[v] }))}
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
                <Link href="/vehicles/new">{t.emptyAction}</Link>
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
                  <TableHead>{t.columns.licensePlate}</TableHead>
                  <TableHead>{t.columns.vehicle}</TableHead>
                  <TableHead>{t.columns.category}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.owner}
                  </TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.inspection}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.insurance}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((v) => (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/vehicles/${v.id}`)}
                  >
                    <TableCell className="font-mono font-medium">
                      {v.licensePlate}
                    </TableCell>
                    <TableCell>
                      {vehicleTitle(v)}
                      {v.internalName && (
                        <span className="block text-xs text-muted-foreground">
                          {v.internalName}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={v.category} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {ownerLabel(v)}
                    </TableCell>
                    <TableCell>
                      <VehicleStatusBadge workerName={assignedName(v)} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <VehicleExpiryDate value={v.nextInspection} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <VehicleExpiryDate value={v.insuranceExpiry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Karten */}
          <div className="space-y-3 md:hidden">
            {items.map((v) => (
              <MobileCard key={v.id} vehicle={v} />
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
          {placeholder}: {texts.vehicles.filters.all}
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

function MobileCard({ vehicle }: { vehicle: VehicleListItem }): React.ReactNode {
  return (
    <Link href={`/vehicles/${vehicle.id}`} className="block">
      <Card className="active:bg-muted/50">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono font-medium">{vehicle.licensePlate}</p>
              <p className="text-sm text-muted-foreground">
                {vehicleTitle(vehicle)}
                {vehicle.internalName ? ` · ${vehicle.internalName}` : ''}
              </p>
            </div>
            <CategoryBadge category={vehicle.category} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <VehicleStatusBadge workerName={assignedName(vehicle)} />
            <span className="text-sm text-muted-foreground">
              {ownerLabel(vehicle)}
            </span>
          </div>
          {(vehicle.nextInspection || vehicle.insuranceExpiry) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {vehicle.nextInspection && (
                <span>
                  {texts.vehicles.columns.inspection}:{' '}
                  <VehicleExpiryDate value={vehicle.nextInspection} />
                </span>
              )}
              {vehicle.insuranceExpiry && (
                <span>
                  {texts.vehicles.columns.insurance}:{' '}
                  <VehicleExpiryDate value={vehicle.insuranceExpiry} />
                </span>
              )}
            </div>
          )}
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
  const p = texts.vehicles.pagination;
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
