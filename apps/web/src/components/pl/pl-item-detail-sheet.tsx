'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { WorkItemStatusBadge } from '@/components/projects/work-item-status-badge';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { texts } from '@/lib/texts';
import {
  customerPlApi,
  WORK_ITEM_REPORT_LABELS,
  WORK_ITEM_REVIEW_LABELS,
  type WorkItemDetail,
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
 * Ein Foto der Fertigmeldung. Der Kunden-PL darf keine Dokumente allgemein
 * laden – der Stream läuft item-gebunden über
 * `GET /pl/work-items/:id/photos/:documentId` und wird hier als Object-URL
 * eingebunden (Klick öffnet das Original in einem neuen Tab).
 */
function ReportPhoto({
  itemId,
  documentId,
  index,
}: {
  itemId: string;
  documentId: string;
  index: number;
}): ReactNode {
  const t = texts.customerPl.detail;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    customerPlApi
      .photoObjectUrl(itemId, documentId)
      .then((value) => {
        objectUrl = value;
        if (active) setUrl(value);
        else URL.revokeObjectURL(value);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemId, documentId]);

  if (failed) {
    return (
      <p className="text-xs text-muted-foreground">{t.photoError}</p>
    );
  }
  if (!url) {
    return <Skeleton className="h-24 w-24 rounded-md" />;
  }
  return (
    <button
      type="button"
      className="overflow-hidden rounded-md border"
      onClick={() => window.open(url, '_blank', 'noopener')}
      aria-label={`${t.photo} ${index + 1}`}
      title={t.openPhoto}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${t.photo} ${index + 1}`}
        className="h-24 w-24 object-cover"
      />
    </button>
  );
}

/**
 * Item-Detail des Kunden-PLs als Drawer: Angaben, Material, Monteure,
 * Rückmeldungen inkl. Fotos, Kontrollen sowie die beiden Prüf-Aktionen
 * „Geprüft / OK“ (nur aus Kontrolle) und „Selbst fertigsetzen“.
 */
export function PlItemDetailSheet({
  itemId,
  onClose,
  onChanged,
}: {
  itemId: string | null;
  onClose: () => void;
  /** Wird nach einer erfolgreichen Prüfung aufgerufen (Board neu laden). */
  onChanged?: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customerPl.detail;
  const a = texts.customerPl.actions;

  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }
    setLoading(true);
    setItem(null);
    setComment('');
    customerPlApi
      .workItem(itemId)
      .then(setItem)
      .catch((err) =>
        toast({
          variant: 'destructive',
          description:
            err instanceof ApiError ? err.message : texts.customerPl.toast.error,
        }),
      )
      .finally(() => setLoading(false));
  }, [itemId, toast]);

  const runReview = useCallback(
    async (
      action: 'approve' | 'forceComplete',
      successMessage: string,
    ): Promise<void> => {
      if (!itemId) return;
      setBusy(true);
      try {
        const trimmed = comment.trim();
        const result =
          action === 'approve'
            ? await customerPlApi.approve(itemId, trimmed || undefined)
            : await customerPlApi.forceComplete(itemId, trimmed || undefined);
        setItem(result.workItem);
        setComment('');
        toast({ description: successMessage });
        onChanged?.();
      } catch (err) {
        toast({
          variant: 'destructive',
          description:
            err instanceof ApiError ? err.message : texts.customerPl.toast.error,
        });
      } finally {
        setBusy(false);
      }
    },
    [itemId, comment, toast, onChanged],
  );

  const canApprove = item?.status === 'REVIEW';
  const isApproved = item?.status === 'APPROVED';

  return (
    <Sheet open={itemId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-mono">
            {item?.itemKey ?? t.title}
          </SheetTitle>
          <SheetDescription>{item?.title ?? t.title}</SheetDescription>
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

            {/* Prüf-Aktionen */}
            <section className="space-y-3 rounded-md border p-3">
              <SectionTitle>{a.title}</SectionTitle>
              {isApproved ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {a.alreadyApproved}
                </p>
              ) : (
                <>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={a.commentPlaceholder}
                    aria-label={a.comment}
                    rows={2}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="min-h-[44px]"
                      disabled={!canApprove || busy}
                      onClick={() =>
                        runReview('approve', texts.customerPl.toast.approved)
                      }
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {busy ? a.approving : a.approve}
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px]"
                      disabled={busy}
                      onClick={() => setForceOpen(true)}
                    >
                      {a.forceComplete}
                    </Button>
                  </div>
                  {!canApprove && (
                    <p className="text-xs text-muted-foreground">
                      {a.approveOnlyInReview}
                    </p>
                  )}
                  {item.status === 'REWORK' && (
                    <p className="text-xs text-muted-foreground">
                      {t.reworkHint}
                    </p>
                  )}
                </>
              )}
            </section>

            {/* Angaben */}
            <section className="space-y-2">
              <SectionTitle>{t.metadata}</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Meta label={t.floor} value={item.floor} />
                <Meta label={t.area} value={item.area} />
                <Meta label={t.room} value={item.room} />
                <Meta label={t.type} value={item.type} />
                <Meta label={t.rc} value={item.rc} />
                <Meta label={t.detailField} value={item.detail} />
                <Meta label={t.planPage} value={item.planPage} />
                <Meta label={t.pdfFile} value={item.pdfFile} />
                <Meta label={t.pdfPage} value={item.pdfPage} />
              </div>
              <Meta label={t.workScope} value={item.workScopeDe} />
            </section>

            {/* Material */}
            <section className="space-y-2">
              <SectionTitle>{t.materials}</SectionTitle>
              {item.materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noMaterials}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">{t.qty}</TableHead>
                      <TableHead>{t.material}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.materials.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {[line.qty, line.qtyUnit].filter(Boolean).join(' ') ||
                            '–'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {line.materialDe}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            {/* Monteure */}
            <section className="space-y-2">
              <SectionTitle>{t.assignments}</SectionTitle>
              {item.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.noAssignments}
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {item.assignments.map((assignment) => (
                    <li key={assignment.id}>
                      {assignment.worker.lastName}, {assignment.worker.firstName}{' '}
                      <span className="text-muted-foreground">
                        · {t.since} {formatDateTime(assignment.startedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Rückmeldungen inkl. Fotos */}
            <section className="space-y-2">
              <SectionTitle>{t.reports}</SectionTitle>
              {item.reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noReports}</p>
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
                        <>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t.photos}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {report.photoDocumentIds.map((docId, index) => (
                              <ReportPhoto
                                key={docId}
                                itemId={item.id}
                                documentId={docId}
                                index={index}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Kontrollen */}
            <section className="space-y-2">
              <SectionTitle>{t.reviews}</SectionTitle>
              {item.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noReviews}</p>
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

            {item.block?.pdfDocumentId && item.pdfFile && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                {t.pdfFile}: {item.pdfFile}
                {item.pdfPage ? ` · ${t.pdfPage} ${item.pdfPage}` : ''}
              </p>
            )}
          </div>
        )}

        <ConfirmDialog
          open={forceOpen}
          onOpenChange={setForceOpen}
          title={texts.customerPl.forceCompleteDialog.title}
          description={texts.customerPl.forceCompleteDialog.description}
          confirmLabel={texts.customerPl.forceCompleteDialog.confirm}
          variant="warning"
          onConfirm={() => {
            setForceOpen(false);
            void runReview(
              'forceComplete',
              texts.customerPl.toast.forceCompleted,
            );
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
