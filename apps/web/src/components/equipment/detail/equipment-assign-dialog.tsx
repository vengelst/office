'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EquipmentWorker } from '@/lib/equipment';
import { texts } from '@/lib/texts';

/** Dialog: Gerät an Monteur ausgeben. */
export function EquipmentAssignDialog({
  open,
  onOpenChange,
  workers,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workers: EquipmentWorker[];
  onSubmit: (data: {
    workerId: string;
    expectedReturn?: string;
    notes?: string;
  }) => void;
}): React.ReactNode {
  const t = texts.equipment.assign;
  const [workerId, setWorkerId] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!workerId) return;
    const fd = new FormData(e.currentTarget);
    onSubmit({
      workerId,
      expectedReturn: (fd.get('expectedReturn') as string) || undefined,
      notes: (fd.get('notes') as string) || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.worker} *</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Monteur wählen …" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.firstName} {w.lastName} ({w.workerNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expectedReturn">{t.expectedReturn}</Label>
            <Input
              id="expectedReturn"
              name="expectedReturn"
              type="date"
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assignNotes">{t.notes}</Label>
            <Textarea id="assignNotes" name="notes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" className="min-h-[44px]" disabled={!workerId}>
              {t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
