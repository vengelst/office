/**
 * Komponente: components/projects/tabs/work-items/item-detail-sheet.tsx (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WorkItemStatusBadge } from '@/components/projects/work-item-status-badge';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { documentsApi } from '@/lib/documents';
import { formatDateTime } from '@/lib/format';
import { texts } from '@/lib/texts';
import {
  formatMinutes,
  workItemsApi,
  WORK_ITEM_REPORT_LABELS,
  WORK_ITEM_REVIEW_LABELS,
  type WorkItemDetail,
  type WorkItemTimeSummary,
} from '@/lib/work-items';

/** Ein Metadatenfeld; leere Werte werden ausgelassen. */
function Meta({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}): ReactNode {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

/** Überschrift eines Detail-Abschnitts. */
function SectionTitle({ children }: { children: ReactNode }): ReactNode {
  return <h4 className="text-sm font-semibold">{children}</h4>;
}

/**
 * Read-only Detailansicht eines Arbeitsitems für das Büro: Metadaten,
 * Materialtabelle, Block-PDF, Zuordnungen, Rückmeldungen, Kontrollen und
 * Item-Zeit. Fertigmeldungen/Kontrollen laufen über Monteur-App bzw. Kunden-PL.
 */
export function ItemDetailSheet({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects.workItems;

  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [time, setTime] = useState<WorkItemTimeSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      setTime(null);
      return;
    }
    setLoading(true);
    setItem(null);
    setTime(null);
    Promise.all([
      workItemsApi.getItem(itemId),
      workItemsApi.itemTime(itemId).catch(() => null),
    ])
      .then(([detail, summary]) => {
        setItem(detail);
        setTime(summary);
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        }),
      )
      .finally(() => setLoading(false));
  }, [itemId, toast]);

  const openDocument = (documentId: string): void => {
    documentsApi
      .fileObjectUrl(documentId)
      .then((url) => window.open(url, '_blank', 'noopener'))
      .catch(() =>
        toast({ variant: 'destructive', description: texts.projects.toast.error }),
      );
  };

  return (
    <Sheet open={itemId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-mono">
            {item?.itemKey ?? t.detail.title}
          </SheetTitle>
          <SheetDescription>
            {item?.title ?? t.detail.readOnlyHint}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {item && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <WorkItemStatusBadge status={item.status} />
              {item.block && (
                <Badge variant="secondary" className="font-mono">
                  {item.block.blockKey}
                </Badge>
              )}
            </div>

            {/* Metadaten */}
            <section className="space-y-2">
              <SectionTitle>{t.detail.metadata}</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Meta label={t.detail.floor} value={item.floor} />
                <Meta label={t.detail.area} value={item.area} />
                <Meta label={t.detail.room} value={item.room} />
                <Meta label={t.detail.type} value={item.type} />
                <Meta label={t.detail.rc} value={item.rc} />
                <Meta label={t.detail.detailField} value={item.detail} />
                <Meta label={t.detail.planPage} value={item.planPage} />
                <Meta
                  label={t.detail.sheet}
                  value={
                    item.sheetNo
                      ? `${item.sheetNo}${item.sheetTotal ? ` / ${item.sheetTotal}` : ''}`
                      : null
                  }
                />
                <Meta label={t.detail.pdfFile} value={item.pdfFile} />
                <Meta label={t.detail.pdfPage} value={item.pdfPage} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Meta label={t.detail.workScopeDe} value={item.workScopeDe} />
                <Meta label={t.detail.workScopeSk} value={item.workScopeSk} />
              </div>
            </section>

            {/* Block-PDF */}
            <section className="space-y-2">
              <SectionTitle>{t.detail.blockPdf}</SectionTitle>
              {item.block?.pdfDocumentId ? (
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => openDocument(item.block?.pdfDocumentId as string)}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t.detail.openBlockPdf}
                  {item.pdfPage ? ` · ${t.detail.pdfPage} ${item.pdfPage}` : ''}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t.detail.noBlockPdf}
                </p>
              )}
            </section>

            {/* Material */}
            <section className="space-y-2">
              <SectionTitle>{t.detail.materials}</SectionTitle>
              {item.materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.detail.noMaterials}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">{t.detail.qty}</TableHead>
                      <TableHead>{t.detail.materialDe}</TableHead>
                      <TableHead>{t.detail.materialSk}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.materials.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {[line.qty, line.qtyUnit].filter(Boolean).join(' ') || '–'}
                        </TableCell>
                        <TableCell className="text-sm">{line.materialDe}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {line.materialSk ?? '–'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            {/* Zuordnungen */}
            <section className="space-y-2">
              <SectionTitle>{t.detail.assignments}</SectionTitle>
              {item.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.detail.noAssignments}
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {item.assignments.map((assignment) => (
                    <li key={assignment.id}>
                      {assignment.worker.lastName}, {assignment.worker.firstName}{' '}
                      <span className="text-muted-foreground">
                        ({assignment.worker.workerNumber}) · {t.detail.since}{' '}
                        {formatDateTime(assignment.startedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Item-Zeit */}
            <section className="space-y-2">
              <SectionTitle>{t.detail.time}</SectionTitle>
              {!time || time.perWorker.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.detail.noTime}</p>
              ) : (
                <div className="space-y-1 text-sm">
                  <p>
                    {t.detail.totalTime}:{' '}
                    <span className="font-medium tabular-nums">
                      {formatMinutes(time.totalMinutes)}
                    </span>
                  </p>
                  <ul className="space-y-1">
                    {time.perWorker.map((worker) => (
                      <li key={worker.workerId} className="text-muted-foreground">
                        {worker.name}: {formatMinutes(worker.minutes)}
                        {worker.open > 0 && ` · ${worker.open} ${t.detail.openSessions}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Rückmeldungen */}
            <section className="space-y-2">
              <SectionTitle>{t.detail.reports}</SectionTitle>
              {item.reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.detail.noReports}
                </p>
              ) : (
                <ul className="space-y-2">
                  {item.reports.map((report) => (
                    <li key={report.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">
                        {WORK_ITEM_REPORT_LABELS[report.type]}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {report.worker.lastName}, {report.worker.firstName} ·{' '}
                          {formatDateTime(report.reportedAt)}
                        </span>
                      </p>
                      {report.comment && <p className="mt-1">{report.comment}</p>}
                      {report.photoDocumentIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {report.photoDocumentIds.map((docId, index) => (
                            <Button
                              key={docId}
                              variant="outline"
                              size="sm"
                              className="min-h-[44px]"
                              onClick={() => openDocument(docId)}
                            >
                              {t.detail.photos} {index + 1}
                            </Button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Kontrollen */}
            <section className="space-y-2">
              <SectionTitle>{t.detail.reviews}</SectionTitle>
              {item.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.detail.noReviews}
                </p>
              ) : (
                <ul className="space-y-2">
                  {item.reviews.map((review) => (
                    <li key={review.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">
                        {WORK_ITEM_REVIEW_LABELS[review.action]}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {review.reviewer?.displayName ?? '–'} ·{' '}
                          {formatDateTime(review.reviewedAt)}
                        </span>
                      </p>
                      {review.comment && <p className="mt-1">{review.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs text-muted-foreground">
              {t.detail.readOnlyHint}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
