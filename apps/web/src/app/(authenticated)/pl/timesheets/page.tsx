'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
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
import { EmptyState } from '@/components/customers/empty-state';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { workerFullName } from '@/lib/workers';
import {
  formatHours,
  timesheetsApi,
  type TimesheetListResponse,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

const LIMIT = 25;

/**
 * Schlanke Stundenzettel-Liste für den Kunden-PL.
 * Die Einschränkung auf die eigenen Projekte macht die API (`GET /timesheets`
 * liefert einem `CUSTOMER_PL` nur Zettel zugewiesener Projekte) – hier gibt es
 * daher bewusst keine Generieren-/Korrektur-Aktionen.
 */
export default function CustomerPlTimesheetsPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.customerPl.timesheets;

  const [data, setData] = useState<TimesheetListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    timesheetsApi
      .list({ page, limit: LIMIT })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.data ?? [];

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
          {t.reload}
        </Button>
      </PageHeader>

      <p className="mb-4 text-sm text-muted-foreground">{t.hint}</p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState message={data ? t.empty : t.noResults} />
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{texts.timesheets.columns.week}</TableHead>
                  <TableHead>{texts.timesheets.columns.worker}</TableHead>
                  <TableHead>{texts.timesheets.columns.project}</TableHead>
                  <TableHead className="text-right">
                    {texts.timesheets.columns.net}
                  </TableHead>
                  <TableHead>{texts.timesheets.columns.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((sheet) => (
                  <TableRow
                    key={sheet.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/pl/timesheets/${sheet.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      router.push(`/pl/timesheets/${sheet.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      KW {sheet.weekNumber}/{sheet.weekYear}
                    </TableCell>
                    <TableCell>{workerFullName(sheet.worker)}</TableCell>
                    <TableCell>{sheet.project.title}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatHours(sheet.totalMinutesNet)}
                    </TableCell>
                    <TableCell>
                      <TimesheetStatusBadge status={sheet.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobil: Karten */}
          <div className="space-y-3 md:hidden">
            {items.map((sheet) => (
              <Card
                key={sheet.id}
                className="cursor-pointer"
                onClick={() => router.push(`/pl/timesheets/${sheet.id}`)}
              >
                <CardContent className="space-y-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      KW {sheet.weekNumber}/{sheet.weekYear}
                    </p>
                    <TimesheetStatusBadge status={sheet.status} />
                  </div>
                  <p className="text-sm">{workerFullName(sheet.worker)}</p>
                  <p className="text-xs text-muted-foreground">
                    {sheet.project.title} · {formatHours(sheet.totalMinutesNet)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {data.total} {texts.timesheets.pagination.showing} ·{' '}
            {texts.timesheets.pagination.page} {data.page}{' '}
            {texts.timesheets.pagination.of} {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {texts.timesheets.pagination.prev}
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px]"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              {texts.timesheets.pagination.next}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
