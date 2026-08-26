'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { timesheetsApi, type TimesheetDetail } from '@/lib/timesheets';
import { texts } from '@/lib/texts';

export function AddDayDialog({
  sheet,
  onClose,
  onSaved,
}: {
  sheet: TimesheetDetail;
  onClose: () => void;
  onSaved: (updated: TimesheetDetail) => void;
}): React.ReactNode {
  const t = texts.timesheets.addDayDialog;
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [brk, setBrk] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    if (!date) return;
    setBusy(true);
    try {
      const updated = await timesheetsApi.upsertDay(sheet.id, {
        workDate: new Date(date + 'T12:00:00').toISOString(),
        firstClockInAt: start ? new Date(start).toISOString() : undefined,
        lastClockOutAt: end ? new Date(end).toISOString() : undefined,
        breakMinutes: Number(brk),
        summaryComment: comment || undefined,
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
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.date}</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
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
          <Button
            className="min-h-[44px]"
            disabled={!date || busy}
            onClick={() => void save()}
          >
            {busy ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
