'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { EQUIPMENT_CONDITIONS } from '@/lib/equipment';
import { texts } from '@/lib/texts';

/** Dialog: Rückgabe registrieren. */
export function EquipmentReturnDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: {
    returnNotes?: string;
    returnCondition?: string;
  }) => void;
}): React.ReactNode {
  const t = texts.equipment.return;
  const condT = texts.equipment.condition;
  const [condition, setCondition] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      returnNotes: (fd.get('returnNotes') as string) || undefined,
      returnCondition: condition || undefined,
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
            <Label>{t.condition}</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Zustand wählen …" />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {condT[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="returnNotes">{t.notes}</Label>
            <Textarea id="returnNotes" name="returnNotes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" className="min-h-[44px]">
              {t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
