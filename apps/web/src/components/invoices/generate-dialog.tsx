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
import { invoicesApi, type InvoiceType } from '@/lib/invoices';
import type { ProjectListItem } from '@/lib/projects';
import type { SubcontractorListItem } from '@/lib/workers';
import { texts } from '@/lib/texts';

export function GenerateDialog({
  open,
  onOpenChange,
  defaultType,
  projects,
  subcontractors,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType: InvoiceType;
  projects: ProjectListItem[];
  subcontractors: SubcontractorListItem[];
  onGenerated: (id: string) => void;
}): React.ReactNode {
  const t = texts.invoices.generateDialog;
  const { toast } = useToast();

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(defaultType);
  const [projectId, setProjectId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [busy, setBusy] = useState(false);

  const incoming = invoiceType === 'INCOMING';
  const canSubmit =
    !!projectId &&
    !!periodFrom &&
    !!periodTo &&
    (!incoming || !!subcontractorId);

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const invoice = await invoicesApi.generate({
        invoiceType,
        projectId,
        periodFrom: new Date(periodFrom).toISOString(),
        periodTo: new Date(periodTo).toISOString(),
        subcontractorId: incoming ? subcontractorId : undefined,
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
            <Label>{t.type}</Label>
            <Select
              value={invoiceType}
              onValueChange={(v) => setInvoiceType(v as InvoiceType)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OUTGOING">
                  {texts.invoices.type.OUTGOING}
                </SelectItem>
                <SelectItem value="INCOMING">
                  {texts.invoices.type.INCOMING}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          {incoming && (
            <div className="space-y-1.5">
              <Label>{t.subcontractor}</Label>
              <Select
                value={subcontractorId}
                onValueChange={setSubcontractorId}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder={t.selectSubcontractor} />
                </SelectTrigger>
                <SelectContent>
                  {subcontractors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.periodFrom}</Label>
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.periodTo}</Label>
              <Input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="min-h-[44px]"
            disabled={!canSubmit || busy}
            onClick={submit}
          >
            {busy ? t.generating : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
