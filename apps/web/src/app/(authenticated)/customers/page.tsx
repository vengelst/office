'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RatingBadge } from '@/components/customers/rating-badge';
import {
  customersApi,
  type CustomerListItem,
  type CustomerListResponse,
} from '@/lib/customers';
import { texts } from '@/lib/texts';

const LIMIT = 25;
type SortField = 'companyName' | 'customerNumber' | 'city' | 'rating';

export default function CustomersPage(): React.ReactNode {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('companyName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [data, setData] = useState<CustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Suche entprellen
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    customersApi
      .list({ page, limit: LIMIT, search: debounced, sortBy, sortDir })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, debounced, sortBy, sortDir]);

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

  const t = texts.customers;
  const items = data?.data ?? [];
  const isEmpty = !loading && items.length === 0;
  const noSearch = debounced.trim() === '';

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button asChild className="min-h-[44px]">
          <Link href="/customers/new">
            <Plus className="h-4 w-4" />
            {t.newCustomer}
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="pl-9 min-h-[44px]"
          aria-label={t.searchPlaceholder}
        />
      </div>

      {loading ? (
        <ListSkeleton />
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {noSearch ? t.empty : t.noResults}
            </p>
            {noSearch && (
              <Button asChild variant="link" className="mt-2">
                <Link href="/customers/new">{t.emptyAction}</Link>
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
                    label={t.columns.customerNumber}
                    active={sortBy === 'customerNumber'}
                    onClick={() => toggleSort('customerNumber')}
                  />
                  <SortHead
                    label={t.columns.companyName}
                    active={sortBy === 'companyName'}
                    onClick={() => toggleSort('companyName')}
                  />
                  <SortHead
                    label={t.columns.city}
                    active={sortBy === 'city'}
                    onClick={() => toggleSort('city')}
                    className="hidden lg:table-cell"
                  />
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.industry}
                  </TableHead>
                  <SortHead
                    label={t.columns.rating}
                    active={sortBy === 'rating'}
                    onClick={() => toggleSort('rating')}
                  />
                  <TableHead>{t.columns.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {c.customerNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.companyName}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {c.city ?? '–'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {c.industry ?? '–'}
                    </TableCell>
                    <TableCell>
                      <RatingBadge rating={c.rating} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Cards */}
          <div className="space-y-3 md:hidden">
            {items.map((c) => (
              <MobileCard key={c.id} customer={c} />
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                setPage((p) => Math.min(data.totalPages, p + 1))
              }
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

function StatusBadge({ status }: { status: string }): React.ReactNode {
  const label =
    texts.customers.status[status as keyof typeof texts.customers.status] ??
    status;
  return (
    <Badge variant={status === 'ACTIVE' ? 'secondary' : 'outline'}>
      {label}
    </Badge>
  );
}

function MobileCard({
  customer,
}: {
  customer: CustomerListItem;
}): React.ReactNode {
  return (
    <Link href={`/customers/${customer.id}`} className="block">
      <Card className="active:bg-muted/50">
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{customer.companyName}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {customer.customerNumber}
            </p>
            {customer.city && (
              <p className="mt-1 text-sm text-muted-foreground">
                {customer.city}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <RatingBadge rating={customer.rating} />
            <StatusBadge status={customer.status} />
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
  const p = texts.customers.pagination;
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
