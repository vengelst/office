'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
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
import { texts } from '@/lib/texts';

const METHOD_KEYS = ['TRANSFER', 'CASH', 'PAYPAL', 'OTHER'] as const;

/** Heutiges Datum als YYYY-MM-DD (lokal). */
function todayInput(): string {
  const d = new Date();
  const pad = (n: number): string => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function PaymentDialog({
  invoiceId,
  defaultAmount,
  onClose,
  onSaved,
}: {
  invoiceId: string;
  defaultAmount: number;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactNode {
  const t = texts.invoices.paymentDialog;
  const { toast } = useToast();
  const [amount, setAmount] = useState(defaultAmount > 0 ? defaultAmount : 0);
  const [paidDate, setPaidDate] = useState(todayInput());
  const [method, setMethod] = useState<string>(
    texts.invoices.methods.TRANSFER,
  );
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    if (!(Number(amount) > 0) || !paidDate) return;
    setBusy(true);
    try {
      await invoicesApi.addPayment(invoiceId, {
        amount: Number(amount),
        paidDate: new Date(paidDate).toISOString(),
        method: method || undefined,
        reference: reference.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.invoices.toast.error,
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
              <Label>{t.amount}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.date}</Label>
              <Input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.method}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_KEYS.map((k) => (
                  <SelectItem
                    key={k}
                    value={texts.invoices.methods[k]}
                  >
                    {texts.invoices.methods[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.reference}</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={onClose}
            disabled={busy}
          >
            {t.cancel}
          </Button>
          <Button
            className="min-h-[44px]"
            disabled={busy || !(Number(amount) > 0)}
            onClick={save}
          >
            {busy ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
