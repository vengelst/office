'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { WorkItemStatusBadge } from '@/components/projects/work-item-status-badge';
import { PlItemDetailSheet } from '@/components/pl/pl-item-detail-sheet';
import { formatDateTime } from '@/lib/format';
import { texts } from '@/lib/texts';
import {
  customerPlApi,
  WORK_ITEM_REPORT_LABELS,
  WORK_ITEM_STATUSES,
  WORK_ITEM_STATUS_LABELS,
  type CustomerPlBoardResponse,
  type WorkItemListEntry,
  type WorkItemStatus,
} from '@/lib/work-items';

/** "5 · A · Lift Lobby" aus Geschoss/Bereich/Raum. */
function locationLabel(item: WorkItemListEntry): string {
  return [item.floor, item.area, item.room].filter(Boolean).join(' · ') || '–';
}

/** Namen der aktiven Monteure eines Items. */
function workerLabel(item: WorkItemListEntry): string {
  if (item.assignments.length === 0) return '–';
  return item.assignments
    .map((a) => `${a.worker.lastName}, ${a.worker.firstName}`)
    .join('; ');
}

/**
 * Item-Board des Kunden-PLs: Status-Zähler als Schnellfilter, Suche und
 * Item-Detail als Drawer (prüfen / selbst fertigsetzen).
 * Daten kommen ausschließlich aus `GET /pl/projects/:id/work-items`.
 */
export default function CustomerPlBoardPage(): React.ReactNode {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const t = texts.customerPl.board;

  const [data, setData] = useState<CustomerPlBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<WorkItemStatus | ''>('');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    customerPlApi
      .workItems(projectId, {
        status: status || undefined,
        q: search || undefined,
      })
      .then((res) => {
        setData(res);
        setFailed(false);
      })
      .catch(() => {
        setData(null);
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [projectId, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items ?? [];
  const counts = data?.statusCounts ?? null;
  const filtered = Boolean(status || search);

  return (
    <div>
      <Link
        href="/pl"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.backToProjects}
      </Link>

      <PageHeader
        title={data?.project?.title ?? t.title}
        description={
          data?.project
            ? `${data.project.projectNumber} · ${t.reviewHint}`
            : t.reviewHint
        }
      >
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

      {/* Status-Zähler des Projekts – zugleich Schnellfilter */}
      {counts && (
        <div className="mb-4 flex flex-wrap gap-2">
          {WORK_ITEM_STATUSES.map((st) => (
            <Button
              key={st}
              type="button"
              variant={status === st ? 'default' : 'secondary'}
              className="min-h-[44px]"
              onClick={() => setStatus(status === st ? '' : st)}
            >
              {WORK_ITEM_STATUS_LABELS[st]}: {counts[st] ?? 0}
            </Button>
          ))}
        </div>
      )}

      {/* Suche */}
      <div className="mb-4 flex gap-2">
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSearch(searchDraft.trim())}
          placeholder={t.search}
          className="min-h-[44px]"
        />
        <Button
          variant="outline"
          className="min-h-[44px]"
          aria-label={t.search}
          onClick={() => setSearch(searchDraft.trim())}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState message={t.notFound} actionLabel={t.reload} onAction={load} />
      ) : items.length === 0 ? (
        <EmptyState message={filtered ? t.empty : t.emptyUnfiltered} />
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.itemKey}</TableHead>
                  <TableHead>{t.columns.title}</TableHead>
                  <TableHead>{t.columns.location}</TableHead>
                  <TableHead>{t.columns.block}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead>{t.columns.workers}</TableHead>
                  <TableHead>{t.columns.lastReport}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(item.id)}
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && setSelectedId(item.id)
                    }
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {item.itemKey}
                    </TableCell>
                    <TableCell className="text-sm">{item.title ?? '–'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {locationLabel(item)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.block?.blockKey ?? '–'}
                    </TableCell>
                    <TableCell>
                      <WorkItemStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {workerLabel(item)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.reports[0]
                        ? `${WORK_ITEM_REPORT_LABELS[item.reports[0].type]} · ${formatDateTime(
                            item.reports[0].reportedAt,
                          )}`
                        : '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobil: Karten */}
          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(item.id)}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-medium">{item.itemKey}</p>
                      <p className="truncate text-sm">{item.title ?? '–'}</p>
                    </div>
                    <WorkItemStatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locationLabel(item)}
                    {item.block && <> · {item.block.blockKey}</>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.columns.workers}: {workerLabel(item)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data && data.total > items.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t.truncated
                .replace('{take}', String(items.length))
                .replace('{total}', String(data.total))}
            </p>
          )}
        </>
      )}

      <PlItemDetailSheet
        itemId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
    </div>
  );
}
