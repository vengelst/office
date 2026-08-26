'use client';

import {
  Archive,
  CheckCircle2,
  Download,
  PenLine,
  Send,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatDate,
  formatTime,
  type SignerType,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

export function SignaturesTab({
  sheet,
  canSubmit,
  canApprove,
  canSign,
  canArchive,
  onSubmit,
  onApprove,
  onReject,
  onArchive,
  onSign,
  onPdf,
}: {
  sheet: TimesheetDetail;
  canSubmit: boolean;
  canApprove: boolean;
  canSign: boolean;
  canArchive: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onArchive: () => void;
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
            {canArchive && (
              <Button
                variant="outline"
                className="min-h-[44px] text-amber-600"
                onClick={onArchive}
              >
                <Archive className="h-4 w-4" />
                {t.actions.archive}
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
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => onSign('MANAGER')}
              >
                <PenLine className="h-4 w-4" />
                {s.signAsManager}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
