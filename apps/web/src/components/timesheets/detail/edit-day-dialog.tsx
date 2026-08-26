'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  timesheetsApi,
  type TimesheetDay,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';
import { toLocalInput } from './utils';

export function EditDayDialog({
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
