'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { invoicesApi } from '@/lib/invoices';
import type { ProjectListItem } from '@/lib/projects';
import { texts } from '@/lib/texts';

export function GenerateDialog({
  open,
  onOpenChange,
  projects,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: ProjectListItem[];
  onGenerated: (id: string) => void;
}): React.ReactNode {
  const t = texts.invoices.generateDialog;
  const { toast } = useToast();

  const [projectId, setProjectId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = !!projectId && !!periodFrom && !!periodTo;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const invoice = await invoicesApi.generate({
        invoiceType: 'OUTGOING',
        projectId,
        periodFrom: new Date(periodFrom).toISOString(),
        periodTo: new Date(periodTo).toISOString(),
      });
      toast({ description: texts.invoices.toast.generated });
      onOpenChange(false);
      onGenerated(invoice.id);
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.invoices.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.project}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder={t.selectProject} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.periodFrom}</Label>
              <Input
                type="date"
                className="min-h-[44px]"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.periodTo}</Label>
              <Input
                type="date"
                className="min-h-[44px]"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="min-h-[44px]"
            disabled={!canSubmit || busy}
            onClick={() => void submit()}
          >
            {busy ? t.generating : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
