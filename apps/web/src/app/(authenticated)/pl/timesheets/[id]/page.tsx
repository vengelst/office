'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  MapPin,
  PenLine,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from '@/components/timesheets/signature-canvas';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { EmptyState } from '@/components/customers/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  downloadTimesheetPdf,
  formatDate,
  formatMinutes,
  formatTime,
  timesheetsApi,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';
import { workerFullName } from '@/lib/workers';

const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function weekdayLabel(iso: string): string {
  return texts.timesheets.days[DAY_KEYS[new Date(iso).getDay()]];
}

/**
 * Wochen-Stundenzettel aus Sicht des Kunden-PLs: Tage read-only.
 * Abzeichnen = digitale Unterschrift (CUSTOMER) + Status APPROVED.
 * Korrigieren/Einreichen bleiben dem Büro vorbehalten.
 */
export default function CustomerPlTimesheetDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = texts.customerPl.timesheets;
  const { toast } = useToast();
  const { user } = useAuth();

  const [sheet, setSheet] = useState<TimesheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    timesheetsApi
      .get(id)
      .then(setSheet)
      .catch(() => setSheet(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const hasCustomerSignature = Boolean(
    sheet?.signatures.some((s) => s.signerType === 'CUSTOMER'),
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <EmptyState message={t.notFound} actionLabel={t.reload} onAction={load} />
    );
  }

  const canApprove = sheet.status === 'SUBMITTED';
  const isApproved =
    sheet.status === 'APPROVED' || sheet.status === 'ARCHIVED';

  return (
    <div>
      <Link
        href="/pl/timesheets"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.backToList}
      </Link>

      <PageHeader
        title={`KW ${sheet.weekNumber}/${sheet.weekYear} · ${workerFullName(sheet.worker)}`}
        description={`${sheet.project.title} · ${sheet.project.customer.companyName}`}
      >
        <TimesheetStatusBadge status={sheet.status} />
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">{t.signHint}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="min-h-[44px]"
              disabled={!canApprove || busy}
              onClick={() => setSignOpen(true)}
            >
              <PenLine className="h-4 w-4" />
              {busy ? t.approving : t.signAndApprove}
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() =>
                downloadTimesheetPdf(
                  sheet.id,
                  `Stundenzettel_KW${sheet.weekNumber}_${workerFullName(sheet.worker)}.pdf`,
                )
                  .then(() => toast({ description: texts.timesheets.toast.pdf }))
                  .catch(() =>
                    toast({
                      variant: 'destructive',
                      description: t.toastError,
                    }),
                  )
              }
            >
              <Download className="h-4 w-4" />
              {t.downloadPdf}
            </Button>
            {isApproved ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {t.approvedAt} {formatDate(sheet.approvedAt)}
                {sheet.approvedBy ? ` · ${sheet.approvedBy.displayName}` : ''}
                {hasCustomerSignature ? ` · ${t.signedDigitally}` : ''}
              </p>
            ) : (
              !canApprove && (
                <p className="text-sm text-muted-foreground">{t.onlySubmitted}</p>
              )
            )}
          </div>

          {sheet.signatures.length > 0 && (
            <ul className="space-y-1 border-t pt-3 text-sm">
              {sheet.signatures.map((sig) => (
                <li key={sig.id} className="text-muted-foreground">
                  {texts.timesheets.signerType[sig.signerType]}: {sig.signerName}{' '}
                  · {formatDate(sig.signedAt)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {sheet.days.length === 0 ? (
        <EmptyState message={texts.timesheets.week.noData} />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{texts.timesheets.week.day}</TableHead>
                <TableHead>{texts.timesheets.week.date}</TableHead>
                <TableHead>{texts.timesheets.week.start}</TableHead>
                <TableHead>{texts.timesheets.week.end}</TableHead>
                <TableHead className="text-right">
                  {texts.timesheets.week.gross}
                </TableHead>
                <TableHead className="text-right">
                  {texts.timesheets.week.break}
                </TableHead>
                <TableHead className="text-right">
                  {texts.timesheets.week.net}
                </TableHead>
                <TableHead>{texts.timesheets.week.comment}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.days.map((day) => (
                <TableRow key={day.id}>
                  <TableCell className="font-medium">
                    {weekdayLabel(day.workDate)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      {formatDate(day.workDate)}
                      {day.clockInLatitude != null &&
                        day.clockInLongitude != null && (
                          <a
                            href={`https://www.google.com/maps?q=${day.clockInLatitude},${day.clockInLongitude}`}
                            target="_blank"
                            rel="noreferrer"
                            title={texts.timesheets.week.gps}
                          >
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                          </a>
                        )}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatTime(day.firstClockInAt)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatTime(day.lastClockOutAt)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMinutes(day.grossMinutes)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMinutes(day.breakMinutes)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatMinutes(day.netMinutes)}
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                    {day.summaryComment ?? ''}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell colSpan={4}>{t.totals}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatMinutes(sheet.totalMinutesGross)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatMinutes(sheet.totalBreakMinutes)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatMinutes(sheet.totalMinutesNet)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}

      {signOpen && (
        <PlSignAndApproveDialog
          sheetId={sheet.id}
          defaultName={user?.displayName ?? ''}
          busy={busy}
          setBusy={setBusy}
          onClose={() => setSignOpen(false)}
          onDone={(updated) => {
            setSheet(updated);
            setSignOpen(false);
            toast({ description: t.toastSignedAndApproved });
          }}
        />
      )}
    </div>
  );
}

function PlSignAndApproveDialog({
  sheetId,
  defaultName,
  busy,
  setBusy,
  onClose,
  onDone,
}: {
  sheetId: string;
  defaultName: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  onDone: (sheet: TimesheetDetail) => void;
}): React.ReactNode {
  const t = texts.customerPl.timesheets;
  const signT = texts.timesheets.signDialog;
  const { toast } = useToast();
  const canvas = useRef<SignatureCanvasHandle>(null);
  const [name, setName] = useState(defaultName);

  const confirm = async (): Promise<void> => {
    const dataUrl = canvas.current?.toDataURL();
    if (!dataUrl) {
      toast({ description: signT.empty });
      return;
    }
    if (!name.trim()) return;
    setBusy(true);
    try {
      await timesheetsApi.sign(sheetId, {
        signerType: 'CUSTOMER',
        signerName: name.trim(),
        signerRole: 'Kunden-PL',
        signatureBase64: dataUrl,
      });
      const approved = await timesheetsApi.approve(sheetId);
      onDone(approved);
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toastError,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.signDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.signDialogHint}</p>
          <div className="space-y-1.5">
            <Label>{signT.name}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {texts.timesheets.signatures.hint}
          </p>
          <SignatureCanvas ref={canvas} />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="min-h-[44px]"
            disabled={busy}
            onClick={() => canvas.current?.clear()}
          >
            {signT.clear}
          </Button>
          <Button
            className="min-h-[44px]"
            disabled={busy || !name.trim()}
            onClick={confirm}
          >
            {busy ? t.approving : t.signAndApprove}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
