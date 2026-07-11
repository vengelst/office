'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Copy,
  Download,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import {
  downloadInvoicePdf,
  formatCurrency,
  invoicePartyName,
  invoicesApi,
  openAmount,
  paidTotal,
  type InvoiceDetail,
} from '@/lib/invoices';
import { texts } from '@/lib/texts';

/**
 * Detail-Seite einer einzelnen Rechnung.
 * Zeigt Positionen (mit Inline-Editor), Zahlungen (mit Fortschrittsbalken)
 * und Rechnungsdetails in einem Tab-Layout.
 * Bietet Aktionen: Versenden, PDF-Download, Duplizieren, Stornieren und Löschen.
 */
export default function InvoiceDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const t = texts.invoices;
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    invoicesApi
      .get(id)
      .then(setInvoice)
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Führt eine API-Aktion aus und aktualisiert die Rechnung bei Erfolg. */
  const runAction = async (
    fn: () => Promise<InvoiceDetail>,
    successMsg: string,
  ): Promise<void> => {
    try {
      const updated = await fn();
      setInvoice(updated);
      toast({ description: successMsg });
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    }
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
        title={invoice.invoiceNumber}
        description={`${t.type[invoice.invoiceType]} · ${invoicePartyName(invoice)}`}
      >
        <InvoiceStatusBadge status={invoice.status} />
      </PageHeader>

      {/* Aktionen */}
      <div className="mb-4 flex flex-wrap gap-2">
        {isDraft && (
          <Button
            className="min-h-[44px]"
            onClick={() =>
              runAction(() => invoicesApi.send(invoice.id), t.toast.sent)
            }
          >
            <Send className="h-4 w-4" />
            {t.actions.send}
          </Button>
        )}
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => {
            downloadInvoicePdf(invoice.id, `${invoice.invoiceNumber}.pdf`)
              .then(() => toast({ description: t.toast.pdf }))
              .catch(() => toast({ description: t.toast.error }));
          }}
        >
          <Download className="h-4 w-4" />
          {t.actions.pdf}
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() =>
            runAction(
              () => invoicesApi.duplicate(invoice.id),
              t.toast.duplicated,
            )
          }
        >
          <Copy className="h-4 w-4" />
          {t.actions.duplicate}
        </Button>
        {!isCancelled && (
          <Button
            variant="outline"
            className="min-h-[44px] text-destructive"
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="h-4 w-4" />
            {t.actions.cancel}
          </Button>
        )}
        {isDraft && (
          <Button
            variant="ghost"
            className="min-h-[44px] text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t.actions.delete}
          </Button>
        )}
      </div>

      <Tabs defaultValue="lines">
        <TabsList className="mb-4">
          <TabsTrigger value="lines">{t.tabs.lines}</TabsTrigger>
          <TabsTrigger value="payments">{t.tabs.payments}</TabsTrigger>
          <TabsTrigger value="details">{t.tabs.details}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Positionen */}
        <TabsContent value="lines">
          <LineEditor
            invoice={invoice}
            editable={isDraft}
            onChanged={setInvoice}
          />
        </TabsContent>

        {/* Tab 2: Zahlungen */}
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

        {/* Tab 3: Details */}
        <TabsContent value="details">
          <DetailsTab invoice={invoice} />
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

// ── Tab 2: Zahlungen ───────────────────────────────────────────

/**
 * Zahlungs-Tab mit Fortschrittsanzeige (bezahlt/offen) und Zahlungstabelle.
 * Zeigt den Zahlungsstand als Prozentbalken und ermöglicht das Erfassen
 * und Löschen einzelner Zahlungseingänge.
 */
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
      {/* Fortschrittsbalken */}
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

// ── Tab 3: Details ─────────────────────────────────────────────

/**
 * Detail-Tab mit allen Rechnungsmetadaten in zwei Spalten.
 * Zeigt Rechnungsnummer, Typ, Status, Daten, Verknüpfungen zu
 * Projekt/Kunde/Subunternehmer, Teilrechnungsdaten und Notizen.
 */
function DetailsTab({ invoice }: { invoice: InvoiceDetail }): React.ReactNode {
  const t = texts.invoices.details;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label={t.invoiceNumber} value={invoice.invoiceNumber} />
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
            label={t.period}
            value={
              invoice.periodFrom || invoice.periodTo
                ? `${formatDate(invoice.periodFrom)} – ${formatDate(invoice.periodTo)}`
                : t.none
            }
          />

          {/* Verknüpfungen */}
          <div className="border-t pt-3">
            <FieldLink
              label={t.project}
              href={invoice.project ? `/projects/${invoice.project.id}` : null}
              value={invoice.project?.title ?? t.none}
            />
            {invoice.invoiceType === 'OUTGOING' ? (
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
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">{t.internalNotes}</p>
              <p className="whitespace-pre-wrap text-sm">
                {invoice.internalNotes || t.none}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Einfaches Label-Wert-Paar in der Rechnungsdetail-Ansicht. */
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

/** Label-Wert-Paar mit optionalem Link (z.B. zum verknüpften Kunden oder Projekt). */
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
