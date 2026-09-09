/**
 * Seite: invoices / detail (Office-Web).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Mail,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { InvoiceStatusBadge } from '@/components/invoices/status-badge';
import { LineEditor } from '@/components/invoices/line-editor';
import { PaymentDialog } from '@/components/invoices/payment-dialog';
import { SendEmailDialog } from '@/components/invoices/send-email-dialog';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { hasPermission } from '@/lib/roles';
import {
  downloadAuthenticated,
  downloadInvoicePdf,
  formatCurrency,
  invoiceNumberLabel,
  invoicePartyName,
  invoicesApi,
  openAmount,
  paidTotal,
  type InvoiceDetail,
  type InvoiceTaxKind,
  type CorrectionReason,
} from '@/lib/invoices';
import { settingsApi } from '@/lib/settings';
import { texts } from '@/lib/texts';

const TAX_KINDS: InvoiceTaxKind[] = [
  'STANDARD',
  'REDUCED',
  'REVERSE_CHARGE',
  'TAX_EXEMPT',
];

const CORRECTION_REASONS: CorrectionReason[] = [
  'INVOICE_ERROR',
  'CONSIDERATION_REDUCTION',
];

export default function InvoiceDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const t = texts.invoices;
  const { toast } = useToast();
  const { user } = useAuth();
  const canFinalize = hasPermission(user, 'invoices.finalize');
  const canSend = hasPermission(user, 'invoices.send');

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [stornoOpen, setStornoOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] =
    useState<CorrectionReason>('INVOICE_ERROR');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nextPreview, setNextPreview] = useState('RE-…');
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    invoicesApi
      .get(id)
      .then((inv) => {
        setInvoice(inv);
        setInternalNotes(inv.internalNotes ?? '');
      })
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (
    fn: () => Promise<InvoiceDetail>,
    successMsg: string,
  ): Promise<void> => {
    try {
      const updated = await fn();
      setInvoice(updated);
      setInternalNotes(updated.internalNotes ?? '');
      toast({ description: successMsg });
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    }
  };

  const openFinalize = async (): Promise<void> => {
    try {
      const billing = await settingsApi.getBilling();
      const preview =
        invoice?.invoiceType === 'CORRECTION'
          ? billing.series.ko.preview
          : invoice?.invoiceType === 'STORNO'
            ? billing.series.st.preview
            : billing.series.re.preview;
      setNextPreview(preview);
    } catch {
      setNextPreview('RE-…');
    }
    setFinalizeOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t.noResults}
        </CardContent>
      </Card>
    );
  }

  const isDraft = invoice.status === 'DRAFT';
  const isCancelled = invoice.status === 'CANCELLED';
  const canEmail =
    canSend &&
    !isDraft &&
    !isCancelled &&
    !!invoice.finalizedAt &&
    (invoice.invoiceType === 'OUTGOING' ||
      invoice.invoiceType === 'STORNO' ||
      invoice.invoiceType === 'CORRECTION');
  const hasRelated = (invoice.creditNotes?.length ?? 0) > 0;
  const canStorno =
    canFinalize &&
    invoice.invoiceType === 'OUTGOING' &&
    !isDraft &&
    !isCancelled &&
    !!invoice.finalizedAt &&
    !hasRelated;
  const canCorrection =
    canFinalize &&
    invoice.invoiceType === 'OUTGOING' &&
    !isDraft &&
    !isCancelled &&
    !!invoice.finalizedAt &&
    !invoice.creditNotes?.some((d) => d.invoiceType === 'STORNO');
  const numberLabel = invoiceNumberLabel(invoice, t.draftNumber);

  return (
    <div>
      <Link
        href="/invoices"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.backToList}
      </Link>

      <PageHeader
        title={numberLabel}
        description={`${t.type[invoice.invoiceType]} · ${invoicePartyName(invoice)}`}
      >
        <InvoiceStatusBadge status={invoice.status} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {isDraft && canFinalize && (
          <Button
            className="min-h-[44px]"
            onClick={() => void openFinalize()}
          >
            <CheckCircle2 className="h-4 w-4" />
            {t.actions.finalize}
          </Button>
        )}
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => {
            downloadInvoicePdf(
              invoice.id,
              `${invoice.invoiceNumber ?? `Entwurf-${invoice.id.slice(-6)}`}.pdf`,
            )
              .then(() => toast({ description: t.toast.pdf }))
              .catch(() => toast({ description: t.toast.error }));
          }}
        >
          <Download className="h-4 w-4" />
          {t.actions.pdf}
        </Button>
        {invoice.finalizedAt && (
          <>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => {
                downloadAuthenticated(
                  invoicesApi.zugferdUrl(invoice.id),
                  `${invoice.invoiceNumber}_zugferd.pdf`,
                )
                  .then(() => toast({ description: 'ZUGFeRD heruntergeladen' }))
                  .catch(() => toast({ description: t.toast.error }));
              }}
            >
              <Download className="h-4 w-4" />
              ZUGFeRD
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => {
                downloadAuthenticated(
                  invoicesApi.xrechnungUrl(invoice.id),
                  `${invoice.invoiceNumber}_xrechnung.xml`,
                )
                  .then(() => toast({ description: 'XRechnung heruntergeladen' }))
                  .catch(() => toast({ description: t.toast.error }));
              }}
            >
              <Download className="h-4 w-4" />
              XRechnung
            </Button>
          </>
        )}
        {canEmail && (
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setEmailOpen(true)}
          >
            <Mail className="h-4 w-4" />
            {t.actions.sendEmail}
          </Button>
        )}
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() =>
            runAction(
              () => invoicesApi.duplicate(invoice.id),
              t.toast.duplicated,
            ).then((_) => undefined)
          }
        >
          <Copy className="h-4 w-4" />
          {t.actions.duplicate}
        </Button>
        {canStorno && (
          <Button
            variant="outline"
            className="min-h-[44px] text-destructive"
            onClick={() => setStornoOpen(true)}
          >
            <XCircle className="h-4 w-4" />
            {t.actions.storno}
          </Button>
        )}
        {canCorrection && (
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setCorrectionOpen(true)}
          >
            <XCircle className="h-4 w-4" />
            {t.actions.correction}
          </Button>
        )}
        {isDraft && (
          <>
            <Button
              variant="outline"
              className="min-h-[44px] text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              {t.actions.cancel}
            </Button>
            <Button
              variant="ghost"
              className="min-h-[44px] text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t.actions.delete}
            </Button>
          </>
        )}
      </div>

      <Tabs defaultValue="lines">
        <TabsList className="mb-4">
          <TabsTrigger value="lines">{t.tabs.lines}</TabsTrigger>
          <TabsTrigger value="payments">{t.tabs.payments}</TabsTrigger>
          <TabsTrigger value="details">{t.tabs.details}</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <LineEditor
            invoice={invoice}
            editable={isDraft}
            onChanged={setInvoice}
          />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab
            invoice={invoice}
            onAdd={() => setPayOpen(true)}
            onDelete={(paymentId) =>
              runAction(async () => {
                await invoicesApi.removePayment(invoice.id, paymentId);
                return invoicesApi.get(invoice.id);
              }, t.toast.paymentDeleted)
            }
          />
        </TabsContent>

        <TabsContent value="details">
          <DetailsTab
            invoice={invoice}
            internalNotes={internalNotes}
            onInternalNotesChange={setInternalNotes}
            savingNotes={savingNotes}
            onChanged={setInvoice}
            onSaveNotes={async () => {
              setSavingNotes(true);
              try {
                await runAction(
                  () =>
                    invoicesApi.update(invoice.id, {
                      internalNotes: internalNotes,
                    }),
                  t.toast.updated,
                );
              } finally {
                setSavingNotes(false);
              }
            }}
          />
        </TabsContent>
      </Tabs>

      {payOpen && (
        <PaymentDialog
          invoiceId={invoice.id}
          defaultAmount={openAmount(invoice)}
          onClose={() => setPayOpen(false)}
          onSaved={async () => {
            setPayOpen(false);
            const updated = await invoicesApi.get(invoice.id);
            setInvoice(updated);
            toast({ description: t.toast.paymentSaved });
          }}
        />
      )}

      {emailOpen && (
        <SendEmailDialog
          invoiceId={invoice.id}
          onClose={() => setEmailOpen(false)}
          onSent={() => setEmailOpen(false)}
        />
      )}

      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.finalizeDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.finalizeDialog.description(nextPreview)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.finalizeDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setFinalizeOpen(false);
                void runAction(
                  () => invoicesApi.finalize(invoice.id),
                  t.toast.finalized,
                );
              }}
            >
              {t.finalizeDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={stornoOpen} onOpenChange={setStornoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.stornoDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.stornoDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 px-1">
            <Label>{t.stornoDialog.reason}</Label>
            <Select
              value={correctionReason}
              onValueChange={(v) =>
                setCorrectionReason(v as CorrectionReason)
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CORRECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t.correctionReason[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.stornoDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setStornoOpen(false);
                void runAction(async () => {
                  const st = await invoicesApi.storno(invoice.id, {
                    correctionReason,
                  });
                  router.push(`/invoices/${st.id}`);
                  return st;
                }, t.toast.storno);
              }}
            >
              {t.stornoDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.correctionDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.correctionDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 px-1">
            <Label>{t.correctionDialog.reason}</Label>
            <Select
              value={correctionReason}
              onValueChange={(v) =>
                setCorrectionReason(v as CorrectionReason)
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CORRECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t.correctionReason[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.correctionDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCorrectionOpen(false);
                void runAction(async () => {
                  const ko = await invoicesApi.correction(invoice.id, {
                    correctionReason,
                  });
                  router.push(`/invoices/${ko.id}`);
                  return ko;
                }, t.toast.correction);
              }}
            >
              {t.correctionDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.cancelDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.cancelDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancelDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCancelOpen(false);
                void runAction(
                  () => invoicesApi.cancel(invoice.id),
                  t.toast.cancelled,
                );
              }}
            >
              {t.cancelDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.deleteDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setDeleteOpen(false);
                try {
                  await invoicesApi.remove(invoice.id);
                  toast({ description: t.toast.deleted });
                  router.push('/invoices');
                } catch (err) {
                  toast({
                    description:
                      err instanceof ApiError ? err.message : t.toast.error,
                  });
                }
              }}
            >
              {t.deleteDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PaymentsTab({
  invoice,
  onAdd,
  onDelete,
}: {
  invoice: InvoiceDetail;
  onAdd: () => void;
  onDelete: (paymentId: string) => void;
}): React.ReactNode {
  const t = texts.invoices.payments;
  const paid = paidTotal(invoice);
  const open = openAmount(invoice);
  const pct =
    invoice.total > 0
      ? Math.min(100, Math.round((paid / invoice.total) * 100))
      : 0;
  const cancelled = invoice.status === 'CANCELLED';

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {t.progress(formatCurrency(paid), formatCurrency(invoice.total))}
            </span>
            <span className="text-muted-foreground">
              {t.open}: {formatCurrency(open)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {cancelled ? (
        <p className="text-sm text-muted-foreground">{t.cancelledHint}</p>
      ) : (
        <Button variant="outline" className="min-h-[44px]" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {t.add}
        </Button>
      )}

      <Card>
        {invoice.payments.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.date}</TableHead>
                <TableHead className="text-right">{t.amount}</TableHead>
                <TableHead className="text-right">{t.skonto}</TableHead>
                <TableHead>{t.method}</TableHead>
                <TableHead>{t.reference}</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.paidDate)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {p.skontoApplied
                      ? formatCurrency(p.skontoAmount)
                      : '–'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.method ?? '–'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.reference ?? '–'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => onDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function DetailsTab({
  invoice,
  internalNotes,
  onInternalNotesChange,
  savingNotes,
  onSaveNotes,
  onChanged,
}: {
  invoice: InvoiceDetail;
  internalNotes: string;
  onInternalNotesChange: (v: string) => void;
  savingNotes: boolean;
  onSaveNotes: () => Promise<void>;
  onChanged: (inv: InvoiceDetail) => void;
}): React.ReactNode {
  const t = texts.invoices.details;
  const { toast } = useToast();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field
            label={t.invoiceNumber}
            value={invoiceNumberLabel(invoice, texts.invoices.draftNumber)}
          />
          <Field
            label={t.type}
            value={texts.invoices.type[invoice.invoiceType]}
          />
          <Field
            label={t.status}
            value={texts.invoices.status[invoice.status]}
          />
          <Field label={t.issueDate} value={formatDate(invoice.issueDate)} />
          <Field
            label={t.dueDate}
            value={invoice.dueDate ? formatDate(invoice.dueDate) : t.none}
          />
          {invoice.finalizedAt && (
            <Field
              label={t.finalizedAt}
              value={formatDate(invoice.finalizedAt)}
            />
          )}
          {invoice.finalizedBy && (
            <Field
              label={t.finalizedBy}
              value={invoice.finalizedBy.displayName}
            />
          )}
          {invoice.paidDate && (
            <Field label={t.paidDate} value={formatDate(invoice.paidDate)} />
          )}
          <Field
            label={t.paymentTerm}
            value={
              invoice.paymentTermDays != null
                ? String(invoice.paymentTermDays)
                : t.none
            }
          />
          <Field
            label={t.performanceCountry}
            value={invoice.performanceCountryCode ?? t.none}
          />
          {invoice.status === 'DRAFT' ? (
            <div className="space-y-1.5">
              <Label>{t.taxKind}</Label>
              <Select
                value={invoice.taxKind ?? 'STANDARD'}
                onValueChange={(v) => {
                  void invoicesApi
                    .update(invoice.id, { taxKind: v as InvoiceTaxKind })
                    .then((updated) => {
                      onChanged(updated);
                      toast({ description: texts.invoices.toast.updated });
                    })
                    .catch((err) =>
                      toast({
                        description:
                          err instanceof ApiError
                            ? err.message
                            : texts.invoices.toast.error,
                      }),
                    );
                }}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {texts.invoices.taxKind[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Field
              label={t.taxKind}
              value={
                texts.invoices.taxKind[invoice.taxKind ?? 'STANDARD']
              }
            />
          )}
          <Field
            label={t.period}
            value={
              invoice.periodFrom || invoice.periodTo
                ? `${formatDate(invoice.periodFrom)} – ${formatDate(invoice.periodTo)}`
                : t.none
            }
          />

          <div className="border-t pt-3">
            <FieldLink
              label={t.project}
              href={invoice.project ? `/projects/${invoice.project.id}` : null}
              value={invoice.project?.title ?? t.none}
            />
            {invoice.invoiceType !== 'INCOMING' ? (
              <FieldLink
                label={t.customer}
                href={
                  invoice.customer
                    ? `/customers/${invoice.customer.id}`
                    : null
                }
                value={invoice.customer?.companyName ?? t.none}
              />
            ) : (
              <FieldLink
                label={t.subcontractor}
                href={
                  invoice.subcontractor
                    ? `/subcontractors/${invoice.subcontractor.id}`
                    : null
                }
                value={invoice.subcontractor?.name ?? t.none}
              />
            )}
            {invoice.creditedInvoice && (
              <FieldLink
                label={t.creditedInvoice}
                href={`/invoices/${invoice.creditedInvoice.id}`}
                value={
                  invoice.creditedInvoice.invoiceNumber ??
                  texts.invoices.draftNumber
                }
              />
            )}
            {invoice.correctionReason && (
              <Field
                label={t.correctionReason}
                value={
                  texts.invoices.correctionReason[invoice.correctionReason]
                }
              />
            )}
            {(invoice.creditNotes?.length ?? 0) > 0 &&
              invoice.creditNotes.map((doc) => (
                <FieldLink
                  key={doc.id}
                  label={t.relatedDocs}
                  href={`/invoices/${doc.id}`}
                  value={
                    doc.invoiceNumber ?? texts.invoices.draftNumber
                  }
                />
              ))}
          </div>

          {invoice.createdBy && (
            <Field label={t.createdBy} value={invoice.createdBy.displayName} />
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {invoice.isPartialInvoice && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.partialTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label={t.partialNumber}
                value={
                  invoice.partialNumber != null
                    ? String(invoice.partialNumber)
                    : t.none
                }
              />
              <Field
                label={t.partialPercentage}
                value={
                  invoice.partialPercentage != null
                    ? `${invoice.partialPercentage}%`
                    : t.none
                }
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.notesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">{t.notes}</p>
              <p className="whitespace-pre-wrap text-sm">
                {invoice.notes || t.none}
              </p>
            </div>
            <div className="border-t space-y-2 pt-3">
              <Label className="text-xs text-muted-foreground">
                {t.internalNotes}
              </Label>
              <Textarea
                value={internalNotes}
                onChange={(e) => onInternalNotesChange(e.target.value)}
                rows={4}
              />
              <Button
                variant="outline"
                className="min-h-[44px]"
                disabled={savingNotes}
                onClick={() => void onSaveNotes()}
              >
                {savingNotes
                  ? texts.invoices.actions.saving
                  : texts.invoices.actions.saveInternalNotes}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactNode {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function FieldLink({
  label,
  href,
  value,
}: {
  label: string;
  href: string | null;
  value: string;
}): React.ReactNode {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {href ? (
        <Link
          href={href}
          className="text-sm font-medium text-primary hover:underline"
        >
          {value}
        </Link>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}
