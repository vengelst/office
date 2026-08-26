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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { timesheetsApi, type TimesheetDetail } from '@/lib/timesheets';
import { texts } from '@/lib/texts';

export function RejectDialog({
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
