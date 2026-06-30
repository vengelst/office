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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  subcontractorsApi,
  type SubcontractorListItem,
  type SubcontractorListResponse,
} from '@/lib/workers';
import { texts } from '@/lib/texts';

const LIMIT = 25;

export default function SubcontractorsPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.subcontractors;
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SubcontractorListResponse | null>(null);
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
    subcontractorsApi
      .list({ page, limit: LIMIT, search: debounced })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.data ?? [];
  const isEmpty = !loading && items.length === 0;
  const noSearch = debounced.trim() === '';

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button asChild className="min-h-[44px]">
          <Link href="/subcontractors/new">
            <Plus className="h-4 w-4" />
            {t.newSubcontractor}
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
                <Link href="/subcontractors/new">{t.emptyAction}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.name}</TableHead>
                  <TableHead>{t.columns.contactPerson}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t.columns.city}
                  </TableHead>
                  <TableHead>{t.columns.workers}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/subcontractors/${s.id}`)}
                  >
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contactPerson ?? '–'}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {s.city ?? '–'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s._count.workers}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Karten */}
          <div className="space-y-3 md:hidden">
            {items.map((s) => (
              <MobileCard key={s.id} sub={s} />
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

function MobileCard({
  sub,
}: {
  sub: SubcontractorListItem;
}): React.ReactNode {
  const t = texts.subcontractors;
  return (
    <Link href={`/subcontractors/${sub.id}`} className="block">
      <Card className="active:bg-muted/50">
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{sub.name}</p>
            {sub.contactPerson && (
              <p className="text-sm text-muted-foreground">
                {sub.contactPerson}
              </p>
            )}
            {sub.city && (
              <p className="text-sm text-muted-foreground">{sub.city}</p>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {sub._count.workers} {t.columns.workers}
          </Badge>
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
  const p = texts.subcontractors.pagination;
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
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
