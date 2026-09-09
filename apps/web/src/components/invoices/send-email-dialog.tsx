/**
 * Dialog: Rechnung per E-Mail an Billing-Adresse senden.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { invoicesApi } from '@/lib/invoices';
import { texts } from '@/lib/texts';

export function SendEmailDialog({
  invoiceId,
  onClose,
  onSent,
}: {
  invoiceId: string;
  onClose: () => void;
  onSent: () => void;
}): React.ReactNode {
  const t = texts.invoices.emailDialog;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [docs, setDocs] = useState<
    Array<{ id: string; title: string | null; originalFilename: string }>
  >([]);
  const [timesheets, setTimesheets] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectedTs, setSelectedTs] = useState<Set<string>>(new Set());
  const [attachZugferd, setAttachZugferd] = useState(true);
  const [attachXRechnung, setAttachXRechnung] = useState(true);

  useEffect(() => {
    invoicesApi
      .getEmailAttachments(invoiceId)
      .then((data) => {
        setRecipient(data.recipient?.email ?? null);
        setDocs(data.customerDocuments);
        setTimesheets(data.timesheets);
        setSelectedTs(new Set(data.timesheets.map((x) => x.id)));
      })
      .catch((err) => {
        toast({
          description:
            err instanceof ApiError ? err.message : texts.invoices.toast.error,
        });
      })
      .finally(() => setLoading(false));
  }, [invoiceId, toast]);

  const toggle = (
    set: Set<string>,
    setter: (s: Set<string>) => void,
    id: string,
  ): void => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const send = async (): Promise<void> => {
    if (!recipient) return;
    setBusy(true);
    try {
      await invoicesApi.sendEmail(invoiceId, {
        documentIds: [...selectedDocs],
        weeklyTimesheetIds: [...selectedTs],
        attachZugferd,
        attachXRechnung,
      });
      toast({ description: texts.invoices.toast.emailSent });
      onSent();
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">{texts.common.loading}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>{t.recipient}</Label>
              <p className="mt-1 text-sm font-medium">
                {recipient ?? t.noRecipient}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t.eInvoice}</Label>
              <label className="flex min-h-[44px] items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={attachZugferd}
                  onChange={(e) => setAttachZugferd(e.target.checked)}
                />
                <span className="text-sm">{t.attachZugferd}</span>
              </label>
              <label className="flex min-h-[44px] items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={attachXRechnung}
                  onChange={(e) => setAttachXRechnung(e.target.checked)}
                />
                <span className="text-sm">{t.attachXRechnung}</span>
              </label>
            </div>
            <div className="space-y-2">
              <Label>{t.attachments}</Label>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noAttachments}</p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <label className="flex min-h-[44px] items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={selectedDocs.has(d.id)}
                          onChange={() =>
                            toggle(selectedDocs, setSelectedDocs, d.id)
                          }
                        />
                        <span className="text-sm">
                          {d.title || d.originalFilename}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t.timesheets}</Label>
              {timesheets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noTimesheets}</p>
              ) : (
                <ul className="space-y-2">
                  {timesheets.map((ts) => (
                    <li key={ts.id}>
                      <label className="flex min-h-[44px] items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={selectedTs.has(ts.id)}
                          onChange={() =>
                            toggle(selectedTs, setSelectedTs, ts.id)
                          }
                        />
                        <span className="text-sm">{ts.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
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
            disabled={busy || loading || !recipient}
            onClick={() => void send()}
          >
            {busy ? t.sending : t.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
