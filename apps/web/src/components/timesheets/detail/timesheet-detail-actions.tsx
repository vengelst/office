'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { ApiError } from '@/lib/api-client';
import { timesheetsApi, type TimesheetDetail } from '@/lib/timesheets';
import { texts } from '@/lib/texts';

export function TimesheetDetailActions({
  sheet,
  editable,
  onRegenerated,
  onAddDay,
  onError,
}: {
  sheet: TimesheetDetail;
  editable: boolean;
  onRegenerated: (updated: TimesheetDetail) => void;
  onAddDay: () => void;
  onError: (message: string) => void;
}): React.ReactNode {
  const t = texts.timesheets;
  const [regenBusy, setRegenBusy] = useState(false);

  if (!editable) {
    return <TimesheetStatusBadge status={sheet.status} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TimesheetStatusBadge status={sheet.status} />
      <Button variant="outline" className="min-h-[44px]" onClick={onAddDay}>
        {t.week.addDay}
      </Button>
      <Button
        variant="outline"
        className="min-h-[44px]"
        disabled={regenBusy}
        onClick={() => {
          setRegenBusy(true);
          timesheetsApi
            .generate({
              workerId: sheet.worker.id,
              projectId: sheet.project.id,
              weekYear: sheet.weekYear,
              weekNumber: sheet.weekNumber,
            })
            .then((res) => {
              if ('sheets' in res) {
                if (res.sheets[0]) onRegenerated(res.sheets[0]);
              } else {
                onRegenerated(res);
              }
            })
            .catch((err) =>
              onError(err instanceof ApiError ? err.message : t.toast.error),
            )
            .finally(() => setRegenBusy(false));
        }}
      >
        {t.week.regenerate}
      </Button>
    </div>
  );
}
