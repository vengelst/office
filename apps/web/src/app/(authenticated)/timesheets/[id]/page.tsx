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
  Pencil,
  Send,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from '@/components/timesheets/signature-canvas';
import { ApiError } from '@/lib/api-client';
import { workerFullName } from '@/lib/workers';
import {
  downloadTimesheetPdf,
  formatDate,
  formatMinutes,
  formatTime,
  timesheetsApi,
  type SignerType,
  type TimesheetDay,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

const EDITABLE = new Set(['DRAFT', 'REJECTED']);
const FINAL = new Set(['APPROVED', 'COMPLETED', 'LOCKED']);
const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function weekdayLabel(iso: string): string {
  const d = new Date(iso);
  const key = DAY_KEYS[d.getDay()];
  return texts.timesheets.days[key];
}

export default function TimesheetDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = texts.timesheets;
  const { toast } = useToast();

  const [sheet, setSheet] = useState<TimesheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDay, setEditDay] = useState<TimesheetDay | null>(null);
  const [signType, setSignType] = useState<SignerType | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

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

  const runAction = async (
    fn: () => Promise<TimesheetDetail>,
    successMsg: string,
  ): Promise<void> => {
    try {
      const updated = await fn();
      setSheet(updated);
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

  if (!sheet) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t.noResults}
        </CardContent>
      </Card>
    );
  }

  const editable = EDITABLE.has(sheet.status);
  const canSubmit = EDITABLE.has(sheet.status);
  const canApprove = sheet.status === 'SUBMITTED';
  const canSign = !FINAL.has(sheet.status);

  return (
    <div>
      <Link
        href="/timesheets"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
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

      <Tabs defaultValue="week">
        <TabsList className="mb-4">
          <TabsTrigger value="week">{t.tabs.week}</TabsTrigger>
          <TabsTrigger value="signatures">{t.tabs.signatures}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Wochenübersicht */}
        <TabsContent value="week">
          <WeekTab
            sheet={sheet}
            editable={editable}
            onEdit={setEditDay}
          />
        </TabsContent>

        {/* Tab 2: Unterschriften & Status */}
        <TabsContent value="signatures">
          <SignaturesTab
            sheet={sheet}
            canSubmit={canSubmit}
            canApprove={canApprove}
            canSign={canSign}
            onSubmit={() =>
              runAction(() => timesheetsApi.submit(sheet.id), t.toast.submitted)
            }
            onApprove={() =>
              runAction(() => timesheetsApi.approve(sheet.id), t.toast.approved)
            }
            onReject={() => setRejectOpen(true)}
            onSign={setSignType}
            onPdf={() => {
              downloadTimesheetPdf(
                sheet.id,
                `Stundenzettel_KW${sheet.weekNumber}_${workerFullName(sheet.worker)}.pdf`,
              )
                .then(() => toast({ description: t.toast.pdf }))
                .catch(() => toast({ description: t.toast.error }));
            }}
          />
        </TabsContent>
      </Tabs>

      {editDay && (
        <EditDayDialog
          day={editDay}
          onClose={() => setEditDay(null)}
          onSaved={(updated) => {
            setSheet(updated);
            setEditDay(null);
            toast({ description: t.toast.dayUpdated });
          }}
          sheetId={sheet.id}
        />
      )}

      {signType && (
        <SignDialog
          signerType={signType}
          defaultName={
            signType === 'WORKER' ? workerFullName(sheet.worker) : ''
          }
          sheetId={sheet.id}
          onClose={() => setSignType(null)}
          onSigned={(updated) => {
            setSheet(updated);
            setSignType(null);
            toast({ description: t.toast.signed });
          }}
        />
      )}

      {rejectOpen && (
        <RejectDialog
          sheetId={sheet.id}
          onClose={() => setRejectOpen(false)}
          onRejected={(updated) => {
            setSheet(updated);
            setRejectOpen(false);
            toast({ description: t.toast.rejected });
          }}
        />
      )}
    </div>
  );
}

// ── Tab 1 ──────────────────────────────────────────────────────

function WeekTab({
  sheet,
  editable,
  onEdit,
}: {
  sheet: TimesheetDetail;
  editable: boolean;
  onEdit: (d: TimesheetDay) => void;
}): React.ReactNode {
  const t = texts.timesheets.week;

  if (sheet.days.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t.noData}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.day}</TableHead>
            <TableHead>{t.date}</TableHead>
            <TableHead>{t.start}</TableHead>
            <TableHead>{t.end}</TableHead>
            <TableHead className="text-right">{t.gross}</TableHead>
            <TableHead className="text-right">{t.break}</TableHead>
            <TableHead className="text-right">{t.net}</TableHead>
            <TableHead>{t.comment}</TableHead>
            {editable && <TableHead className="w-px" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sheet.days.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">
                {weekdayLabel(d.workDate)}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  {formatDate(d.workDate)}
                  {d.clockInLatitude != null && d.clockInLongitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${d.clockInLatitude},${d.clockInLongitude}`}
                      target="_blank"
                      rel="noreferrer"
                      title={t.gps}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </a>
                  )}
                </span>
              </TableCell>
              <TableCell className="font-mono">
                {formatTime(d.firstClockInAt)}
              </TableCell>
              <TableCell className="font-mono">
                {formatTime(d.lastClockOutAt)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatMinutes(d.grossMinutes)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatMinutes(d.breakMinutes)}
              </TableCell>
              <TableCell className="text-right font-mono font-medium">
                {formatMinutes(d.netMinutes)}
              </TableCell>
              <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                {d.summaryComment ?? ''}
              </TableCell>
              {editable && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => onEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {/* Summenzeile */}
          <TableRow className="border-t-2 font-semibold">
            <TableCell colSpan={4}>{t.total}</TableCell>
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
            {editable && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}

// ── Tab 2 ──────────────────────────────────────────────────────

function SignaturesTab({
  sheet,
  canSubmit,
  canApprove,
  canSign,
  onSubmit,
  onApprove,
  onReject,
  onSign,
  onPdf,
}: {
  sheet: TimesheetDetail;
  canSubmit: boolean;
  canApprove: boolean;
  canSign: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSign: (s: SignerType) => void;
  onPdf: () => void;
}): React.ReactNode {
  const t = texts.timesheets;
  const s = t.signatures;

  const steps: { label: string; value: string | null; who?: string | null }[] =
    [
      { label: s.generated, value: sheet.generatedAt },
      { label: s.submitted, value: sheet.submittedAt },
      {
        label: s.reviewed,
        value: sheet.reviewedAt,
        who: sheet.reviewedBy?.displayName,
      },
      {
        label: s.approved,
        value: sheet.approvedAt,
        who: sheet.approvedBy?.displayName,
      },
      { label: s.rejected, value: sheet.rejectedAt },
    ].filter((st) => st.value);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Status-Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.timeline}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-3">
            {steps.map((st) => (
              <li key={st.label} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">{st.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(st.value)} {formatTime(st.value)}
                    {st.who ? ` · ${st.who}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {sheet.status === 'REJECTED' && sheet.rejectionReason && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs font-semibold text-destructive">
                {s.rejectionReason}
              </p>
              <p className="text-sm">{sheet.rejectionReason}</p>
            </div>
          )}

          {/* Workflow-Aktionen */}
          <div className="flex flex-wrap gap-2 pt-2">
            {canSubmit && (
              <Button className="min-h-[44px]" onClick={onSubmit}>
                <Send className="h-4 w-4" />
                {t.actions.submit}
              </Button>
            )}
            {canApprove && (
              <Button
                className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
                onClick={onApprove}
              >
                <CheckCircle2 className="h-4 w-4" />
                {t.actions.approve}
              </Button>
            )}
            {canApprove && (
              <Button
                variant="destructive"
                className="min-h-[44px]"
                onClick={onReject}
              >
                <XCircle className="h-4 w-4" />
                {t.actions.reject}
              </Button>
            )}
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={onPdf}
            >
              <Download className="h-4 w-4" />
              {t.actions.downloadPdf}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Unterschriften */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.existing}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sheet.signatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">{s.none}</p>
          ) : (
            <ul className="space-y-2">
              {sheet.signatures.map((sig) => (
                <li
                  key={sig.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {sig.signerName}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t.signerType[sig.signerType]}
                        {sig.signerRole ? ` · ${sig.signerRole}` : ''}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.signedAt} {formatDate(sig.signedAt)}{' '}
                      {formatTime(sig.signedAt)}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {s.present}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {canSign && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => onSign('WORKER')}
              >
                <PenLine className="h-4 w-4" />
                {s.signAsWorker}
              </Button>
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => onSign('SUPERVISOR')}
              >
                <PenLine className="h-4 w-4" />
                {s.signAsSupervisor}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Dialoge ────────────────────────────────────────────────────

function EditDayDialog({
  day,
  sheetId,
  onClose,
  onSaved,
}: {
  day: TimesheetDay;
  sheetId: string;
  onClose: () => void;
  onSaved: (updated: TimesheetDetail) => void;
}): React.ReactNode {
  const t = texts.timesheets.editDay;
  const { toast } = useToast();
  const [start, setStart] = useState(toLocalInput(day.firstClockInAt));
  const [end, setEnd] = useState(toLocalInput(day.lastClockOutAt));
  const [brk, setBrk] = useState(day.breakMinutes ?? 0);
  const [comment, setComment] = useState(day.summaryComment ?? '');
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      const updated = await timesheetsApi.updateDay(sheetId, day.id, {
        firstClockInAt: start ? new Date(start).toISOString() : undefined,
        lastClockOutAt: end ? new Date(end).toISOString() : undefined,
        breakMinutes: Number(brk),
        summaryComment: comment,
      });
      onSaved(updated);
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.timesheets.toast.error,
      });
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.start}</Label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.end}</Label>
              <Input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.break}</Label>
            <Input
              type="number"
              min={0}
              value={brk}
              onChange={(e) => setBrk(Number(e.target.value))}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t.comment}</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button className="min-h-[44px]" disabled={busy} onClick={save}>
            {busy ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignDialog({
  signerType,
  defaultName,
  sheetId,
  onClose,
  onSigned,
}: {
  signerType: SignerType;
  defaultName: string;
  sheetId: string;
  onClose: () => void;
  onSigned: (updated: TimesheetDetail) => void;
}): React.ReactNode {
  const t = texts.timesheets.signDialog;
  const s = texts.timesheets.signatures;
  const { toast } = useToast();
  const canvas = useRef<SignatureCanvasHandle>(null);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);

  const confirm = async (): Promise<void> => {
    const dataUrl = canvas.current?.toDataURL();
    if (!dataUrl) {
      toast({ description: t.empty });
      return;
    }
    if (!name.trim()) return;
    setBusy(true);
    try {
      const updated = await timesheetsApi.sign(sheetId, {
        signerType,
        signerName: name.trim(),
        signatureBase64: dataUrl,
      });
      onSigned(updated);
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.timesheets.toast.error,
      });
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.title} · {texts.timesheets.signerType[signerType]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t.name}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <p className="text-xs text-muted-foreground">{s.hint}</p>
          <SignatureCanvas ref={canvas} />
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => canvas.current?.clear()}
          >
            {t.clear}
          </Button>
          <Button
            className="min-h-[44px]"
            disabled={busy || !name.trim()}
            onClick={confirm}
          >
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  sheetId,
  onClose,
  onRejected,
}: {
  sheetId: string;
  onClose: () => void;
  onRejected: (updated: TimesheetDetail) => void;
}): React.ReactNode {
  const t = texts.timesheets.rejectDialog;
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async (): Promise<void> => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const updated = await timesheetsApi.reject(sheetId, reason.trim());
      onRejected(updated);
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.timesheets.toast.error,
      });
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>{t.reason}</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.reasonPlaceholder}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            className="min-h-[44px]"
            disabled={busy || !reason.trim()}
            onClick={confirm}
          >
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ISO-String → Wert für <input type="datetime-local"> (lokal). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
