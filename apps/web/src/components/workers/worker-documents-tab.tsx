'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/customers/customer-form';
import { DocumentsTab } from '@/components/customers/tabs/documents-tab';
import { ExpiryDate } from '@/components/workers/worker-badges';
import { useToast } from '@/components/ui/use-toast';
import { workersApi, type WorkerDetail } from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

type FormState = {
  idNumber: string;
  taxNumber: string;
  socialSecurityNumber: string;
  oib: string;
  passportNumber: string;
  passportExpiry: string;
  residencePermitNumber: string;
  residencePermitExpiry: string;
  workPermitNumber: string;
  workPermitExpiry: string;
};

const dateOnly = (v: string | null): string => (v ? v.slice(0, 10) : '');

export function WorkerDocumentsTab({
  worker,
  onSaved,
}: {
  worker: WorkerDetail;
  onSaved: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.workers;
  const f = t.fields;
  const s = t.sections;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    idNumber: worker.idNumber ?? '',
    taxNumber: worker.taxNumber ?? '',
    socialSecurityNumber: worker.socialSecurityNumber ?? '',
    oib: worker.oib ?? '',
    passportNumber: worker.passportNumber ?? '',
    passportExpiry: dateOnly(worker.passportExpiry),
    residencePermitNumber: worker.residencePermitNumber ?? '',
    residencePermitExpiry: dateOnly(worker.residencePermitExpiry),
    workPermitNumber: worker.workPermitNumber ?? '',
    workPermitExpiry: dateOnly(worker.workPermitExpiry),
  });

  const set = (k: keyof FormState, v: string): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = (): void => {
    const opt = (v: string): string | undefined => (v.trim() ? v : undefined);
    setSaving(true);
    workersApi
      .update(worker.id, {
        idNumber: opt(form.idNumber),
        taxNumber: opt(form.taxNumber),
        socialSecurityNumber: opt(form.socialSecurityNumber),
        oib: opt(form.oib),
        passportNumber: opt(form.passportNumber),
        passportExpiry: opt(form.passportExpiry),
        residencePermitNumber: opt(form.residencePermitNumber),
        residencePermitExpiry: opt(form.residencePermitExpiry),
        workPermitNumber: opt(form.workPermitNumber),
        workPermitExpiry: opt(form.workPermitExpiry),
      })
      .then(() => {
        toast({ description: t.toast.updated });
        onSaved();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-8 pt-6">
          {/* Ausweise & IDs */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {s.ids}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={f.idNumber}>
                <Input
                  value={form.idNumber}
                  onChange={(e) => set('idNumber', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.taxNumber}>
                <Input
                  value={form.taxNumber}
                  onChange={(e) => set('taxNumber', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.socialSecurityNumber}>
                <Input
                  value={form.socialSecurityNumber}
                  onChange={(e) => set('socialSecurityNumber', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.oib}>
                <Input
                  value={form.oib}
                  onChange={(e) => set('oib', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
          </section>

          {/* Reisedokumente */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {s.travelDocs}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ExpiringField
                numberLabel={f.passportNumber}
                numberValue={form.passportNumber}
                onNumberChange={(v) => set('passportNumber', v)}
                expiryLabel={f.passportExpiry}
                expiryValue={form.passportExpiry}
                onExpiryChange={(v) => set('passportExpiry', v)}
              />
              <ExpiringField
                numberLabel={f.residencePermitNumber}
                numberValue={form.residencePermitNumber}
                onNumberChange={(v) => set('residencePermitNumber', v)}
                expiryLabel={f.residencePermitExpiry}
                expiryValue={form.residencePermitExpiry}
                onExpiryChange={(v) => set('residencePermitExpiry', v)}
              />
              <ExpiringField
                numberLabel={f.workPermitNumber}
                numberValue={form.workPermitNumber}
                onNumberChange={(v) => set('workPermitNumber', v)}
                expiryLabel={f.workPermitExpiry}
                expiryValue={form.workPermitExpiry}
                onExpiryChange={(v) => set('workPermitExpiry', v)}
              />
            </div>
          </section>

          <div>
            <Button onClick={save} disabled={saving} className="min-h-[44px]">
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dokumente */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.documents}
        </h3>
        <DocumentsTab entityId={worker.id} entityType="WORKER" />
      </section>
    </div>
  );
}

/** Nummern-Feld + Ablaufdatum mit Farb-Indikator (gelb/rot). */
function ExpiringField({
  numberLabel,
  numberValue,
  onNumberChange,
  expiryLabel,
  expiryValue,
  onExpiryChange,
}: {
  numberLabel: string;
  numberValue: string;
  onNumberChange: (v: string) => void;
  expiryLabel: string;
  expiryValue: string;
  onExpiryChange: (v: string) => void;
}): ReactNode {
  return (
    <>
      <Field label={numberLabel}>
        <Input
          value={numberValue}
          onChange={(e) => onNumberChange(e.target.value)}
          className="min-h-[44px]"
        />
      </Field>
      <Field label={expiryLabel}>
        <Input
          type="date"
          value={expiryValue}
          onChange={(e) => onExpiryChange(e.target.value)}
          className="min-h-[44px]"
        />
        {expiryValue && (
          <p className="text-xs">
            <ExpiryDate value={expiryValue} />
          </p>
        )}
      </Field>
    </>
  );
}
