'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
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
import { customersApi, type CustomerListItem } from '@/lib/customers';
import { projectsApi } from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const SERVICE_TYPES = ['VIDEO', 'ELECTRICAL', 'SERVICE', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export default function NewProjectPage(): React.ReactNode {
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.projects;
  const f = t.fields;

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    customerId: '',
    serviceType: 'VIDEO' as (typeof SERVICE_TYPES)[number],
    priority: 'MEDIUM' as (typeof PRIORITIES)[number],
  });

  useEffect(() => {
    customersApi
      .list({ limit: 500, sortBy: 'companyName', sortDir: 'asc' })
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]));
  }, []);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!form.title.trim() || !form.customerId) return;
    setSubmitting(true);
    projectsApi
      .create({
        title: form.title.trim(),
        customerId: form.customerId,
        serviceType: form.serviceType,
        priority: form.priority,
      })
      .then((created) => {
        toast({ description: t.toast.created });
        router.push(`/projects/${created.id}`);
      })
      .catch((err) => {
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        });
        setSubmitting(false);
      });
  };

  return (
    <div className="max-w-2xl">
      <Link
        href="/projects"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.backToList}
      </Link>
      <PageHeader title={t.createTitle} description={t.createSubtitle} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-6">
            <Field label={f.title} required>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.customer} required>
              <Select
                value={form.customerId}
                onValueChange={(v) => setForm((p) => ({ ...p, customerId: v }))}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={f.serviceType}>
                <Select
                  value={form.serviceType}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      serviceType: v as (typeof SERVICE_TYPES)[number],
                    }))
                  }
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {t.serviceType[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={f.priority}>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      priority: v as (typeof PRIORITIES)[number],
                    }))
                  }
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((pr) => (
                      <SelectItem key={pr} value={pr}>
                        {t.priority[pr]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={submitting || !form.title.trim() || !form.customerId}
                className="min-h-[44px]"
              >
                {submitting ? t.actions.saving : t.actions.save}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/projects')}
                className="min-h-[44px]"
              >
                {t.actions.cancel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
