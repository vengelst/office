'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/customers/customer-form';
import { useToast } from '@/components/ui/use-toast';
import {
  subcontractorsApi,
  workersApi,
  type SubcontractorListItem,
  type WorkerDetail,
  type WorkerType,
} from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const dateOnly = (v: string | null): string => (v ? v.slice(0, 10) : '');

export function WorkerContractTab({
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

  const [subs, setSubs] = useState<SubcontractorListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [workerType, setWorkerType] = useState<WorkerType>(worker.workerType);
  const [subcontractorId, setSubcontractorId] = useState(
    worker.subcontractorId ?? '',
  );
  const [contractStart, setContractStart] = useState(
    dateOnly(worker.contractStart),
  );
  const [contractEnd, setContractEnd] = useState(dateOnly(worker.contractEnd));
  const [hourlyRate, setHourlyRate] = useState(
    worker.hourlyRate != null ? String(worker.hourlyRate) : '',
  );
  const [dailyRate, setDailyRate] = useState(
    worker.dailyRate != null ? String(worker.dailyRate) : '',
  );

  useEffect(() => {
    subcontractorsApi
      .list({ active: true, limit: 100 })
      .then((r) => setSubs(r.data))
      .catch(() => setSubs([]));
  }, []);

  const isSub = workerType === 'SUBCONTRACTED';
  const missingSub = isSub && !subcontractorId;

  const num = (v: string): number | undefined => {
    if (!v.trim()) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const save = (): void => {
    if (missingSub) {
      toast({
        variant: 'destructive',
        description:
          'Für Subunternehmer-Monteure muss ein Subunternehmen gewählt werden.',
      });
      return;
    }
    setSaving(true);
    workersApi
      .update(worker.id, {
        workerType,
        subcontractorId: isSub ? subcontractorId : null,
        contractStart: contractStart || null,
        contractEnd: contractEnd || null,
        hourlyRate: num(hourlyRate),
        dailyRate: num(dailyRate),
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
    <Card>
      <CardContent className="space-y-8 pt-6">
        {/* Typ & Subunternehmen */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {s.typeSub}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={f.type}>
              <Select
                value={workerType}
                onValueChange={(v) => setWorkerType(v as WorkerType)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYED">
                    {texts.workers.type.EMPLOYED}
                  </SelectItem>
                  <SelectItem value="SUBCONTRACTED">
                    {texts.workers.type.SUBCONTRACTED}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {isSub && (
              <Field
                label={f.subcontractor}
                required
                error={
                  missingSub ? 'Subunternehmen erforderlich' : undefined
                }
              >
                <Select
                  value={subcontractorId}
                  onValueChange={setSubcontractorId}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="–" />
                  </SelectTrigger>
                  <SelectContent>
                    {subs.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          {isSub && subcontractorId && (
            <Button asChild variant="outline" size="sm" className="min-h-[44px]">
              <Link href={`/subcontractors/${subcontractorId}`}>
                <ExternalLink className="h-4 w-4" />
                {t.actions.openSubcontractor}
              </Link>
            </Button>
          )}
        </section>

        {/* Vertragsdaten */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {s.contractData}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={f.contractStart}>
              <Input
                type="date"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.contractEnd}>
              <Input
                type="date"
                value={contractEnd}
                onChange={(e) => setContractEnd(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
          </div>
        </section>

        {/* Stundensätze */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {s.rates}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={f.hourlyRate}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.dailyRate}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
          </div>
        </section>

        <div>
          <Button
            onClick={save}
            disabled={saving || missingSub}
            className="min-h-[44px]"
          >
            {saving ? t.actions.saving : t.actions.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
