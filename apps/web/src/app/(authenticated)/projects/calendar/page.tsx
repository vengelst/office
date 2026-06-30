'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/customers/customer-form';
import { Input } from '@/components/ui/input';
import { ProjectTimeline } from '@/components/projects/project-timeline';
import {
  projectsApi,
  type ProjectStatus,
  type ProjectTimelineItem,
} from '@/lib/projects';
import { customersApi, type CustomerListItem } from '@/lib/customers';
import { texts } from '@/lib/texts';

const ALL = '__all__';
const STATUSES: ProjectStatus[] = [
  'DRAFT',
  'PLANNED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELED',
];

/** Standard-Zeitraum: Monatsanfang bis +3 Monate. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 3, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function ProjectCalendarPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.projects;
  const init = useMemo(defaultRange, []);

  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [status, setStatus] = useState<string>(ALL);
  const [customerId, setCustomerId] = useState<string>(ALL);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [items, setItems] = useState<ProjectTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customersApi
      .list({ limit: 500, sortBy: 'companyName', sortDir: 'asc' })
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    projectsApi
      .timeline({
        from,
        to,
        customerId: customerId === ALL ? undefined : customerId,
      })
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [from, to, customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (status === ALL ? items : items.filter((p) => p.status === status)),
    [items, status],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t.calendar.title} description={t.subtitle} />

      {/* Filter */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-4">
          <Field label={t.calendar.plannedStart}>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={t.calendar.plannedEnd}>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={t.fields.status}>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle</SelectItem>
                {STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {t.status[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.fields.customer}>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ProjectTimeline
          items={filtered}
          from={from}
          to={to}
          onSelect={(pid) => router.push(`/projects/${pid}`)}
        />
      )}
    </div>
  );
}
