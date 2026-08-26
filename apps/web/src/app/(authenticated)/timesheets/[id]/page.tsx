/**
 * Seite: timesheets / detail (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { AddDayDialog } from '@/components/timesheets/detail/add-day-dialog';
import { EDITABLE, FINAL } from '@/components/timesheets/detail/constants';
import { EditDayDialog } from '@/components/timesheets/detail/edit-day-dialog';
import { RejectDialog } from '@/components/timesheets/detail/reject-dialog';
import { SignDialog } from '@/components/timesheets/detail/sign-dialog';
import { SignaturesTab } from '@/components/timesheets/detail/signatures-tab';
import { TimesheetDetailActions } from '@/components/timesheets/detail/timesheet-detail-actions';
import { WeekTab } from '@/components/timesheets/detail/week-tab';
import { ApiError } from '@/lib/api-client';
import { workerFullName } from '@/lib/workers';
import {
  downloadTimesheetPdf,
  timesheetsApi,
  type SignerType,
  type TimesheetDay,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

/**
 * UI-Komponente `TimesheetDetailPage`.
 */
export default function TimesheetDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = texts.timesheets;
  const { toast } = useToast();

  const [sheet, setSheet] = useState<TimesheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDay, setEditDay] = useState<TimesheetDay | null>(null);
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [signType, setSignType] = useState<SignerType | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

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
  const canArchive = sheet.status === 'APPROVED';

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
        <TimesheetDetailActions
          sheet={sheet}
          editable={editable}
          onAddDay={() => setAddDayOpen(true)}
          onRegenerated={(updated) => {
            setSheet(updated);
            toast({ description: t.toast.regenerated });
          }}
          onError={(message) => toast({ description: message })}
        />
      </PageHeader>

      <Tabs defaultValue="week">
        <TabsList className="mb-4">
          <TabsTrigger value="week">{t.tabs.week}</TabsTrigger>
          <TabsTrigger value="signatures">{t.tabs.signatures}</TabsTrigger>
        </TabsList>

        <TabsContent value="week">
          <WeekTab
            sheet={sheet}
            editable={editable}
            onEdit={setEditDay}
          />
        </TabsContent>

        <TabsContent value="signatures">
          <SignaturesTab
            sheet={sheet}
            canSubmit={canSubmit}
            canApprove={canApprove}
            canSign={canSign}
            canArchive={canArchive}
            onSubmit={() =>
              runAction(() => timesheetsApi.submit(sheet.id), t.toast.submitted)
            }
            onApprove={() =>
              runAction(() => timesheetsApi.approve(sheet.id), t.toast.approved)
            }
            onReject={() => setRejectOpen(true)}
            onArchive={() => setArchiveOpen(true)}
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

      {addDayOpen && (
        <AddDayDialog
          sheet={sheet}
          onClose={() => setAddDayOpen(false)}
          onSaved={(updated) => {
            setSheet(updated);
            setAddDayOpen(false);
            toast({ description: t.toast.dayUpdated });
          }}
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

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t.archiveTitle}
        description={t.archiveConfirm}
        confirmLabel={t.actions.archive}
        variant="warning"
        onConfirm={() => {
          runAction(
            () => timesheetsApi.archive(sheet.id),
            t.toast.archived,
          );
          setArchiveOpen(false);
        }}
      />
    </div>
  );
}
