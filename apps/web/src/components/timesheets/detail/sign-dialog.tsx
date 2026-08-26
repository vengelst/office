'use client';

import { useRef, useState } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from '@/components/timesheets/signature-canvas';
import { ApiError } from '@/lib/api-client';
import {
  timesheetsApi,
  type SignerType,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

export function SignDialog({
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
