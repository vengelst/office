'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  invoicesApi,
  type CreateInvoiceBody,
  type InvoiceType,
} from '@/lib/invoices';
import { projectsApi, type ProjectListItem } from '@/lib/projects';
import { customersApi, type CustomerListItem } from '@/lib/customers';
import { subcontractorsApi, type SubcontractorListItem } from '@/lib/workers';
import { texts } from '@/lib/texts';

const NONE = '__none__';

export default function NewInvoicePage(): React.ReactNode {
  const router = useRouter();
  const t = texts.invoices.create;
  const { toast } = useToast();

  const [invoiceType, setInvoiceType] = useState<InvoiceType>('OUTGOING');
  const [projectId, setProjectId] = useState(NONE);
  const [customerId, setCustomerId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [taxRate, setTaxRate] = useState(19);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [partialNumber, setPartialNumber] = useState(1);
  const [partialPercentage, setPartialPercentage] = useState(0);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorListItem[]>(
    [],
  );

  useEffect(() => {
    projectsApi
      .list({ limit: 100 })
      .then((r) => setProjects(r.data))
      .catch(() => setProjects([]));
    customersApi
      .list({ limit: 100 })
      .then((r) => setCustomers(r.data))
      .catch(() => setCustomers([]));
    subcontractorsApi
      .list({ limit: 100 })
      .then((r) => setSubcontractors(r.data))
      .catch(() => setSubcontractors([]));
  }, []);

  const incoming = invoiceType === 'INCOMING';
  const canSubmit = incoming ? !!subcontractorId : true;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    const body: CreateInvoiceBody = {
      invoiceType,
      projectId: projectId === NONE ? undefined : projectId,
      customerId: !incoming && customerId ? customerId : undefined,
      subcontractorId: incoming && subcontractorId ? subcontractorId : undefined,
      taxRate: Number(taxRate),
      periodFrom: periodFrom ? new Date(periodFrom).toISOString() : undefined,
      periodTo: periodTo ? new Date(periodTo).toISOString() : undefined,
      isPartialInvoice: isPartial,
      partialNumber: isPartial ? Number(partialNumber) : undefined,
      partialPercentage: isPartial ? Number(partialPercentage) : undefined,
      notes: notes.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
    };
    try {
      const invoice = await invoicesApi.create(body);
      toast({ description: texts.invoices.toast.created });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.invoices.toast.error,
      });
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/invoices"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {texts.invoices.backToList}
      </Link>

      <PageHeader title={t.title} description={t.subtitle} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{texts.invoices.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <SelectItem value={NONE}>{t.none}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {incoming ? (
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
          ) : (
            <div className="space-y-1.5">
              <Label>{t.customer}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder={t.selectCustomer} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t.taxRate}</Label>
              <Input
                type="number"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
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

          {/* Teilrechnung */}
          <div className="space-y-3 rounded-md border p-3">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isPartial}
                onChange={(e) => setIsPartial(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm font-medium">{t.isPartial}</span>
            </label>
            {isPartial && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t.partialNumber}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={partialNumber}
                    onChange={(e) => setPartialNumber(Number(e.target.value))}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.partialPercentage}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={partialPercentage}
                    onChange={(e) =>
                      setPartialPercentage(Number(e.target.value))
                    }
                    className="min-h-[44px]"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t.notes}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t.internalNotes}</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => router.push('/invoices')}
              disabled={busy}
            >
              {t.cancel}
            </Button>
            <Button
              className="min-h-[44px]"
              onClick={submit}
              disabled={busy || !canSubmit}
            >
              {busy ? t.submitting : t.submit}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
